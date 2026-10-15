import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { SenhaService } from '../auth/senha/senha.service.js';
import { LicencasService } from '../licencas/licencas.service.js';
import type {
  ConfirmarSyncLoteDto,
  IniciarSyncLoteDto,
} from './dto/sync.dto.js';

function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly licencas: LicencasService,
    private readonly auditoria: AuditoriaService,
    private readonly senha: SenhaService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL');
  }

  async iniciarLote(
    contaId: string,
    tokenApiId: string,
    dto: IniciarSyncLoteDto,
  ) {
    // 1. Validação de regras da licença
    const licenca = await this.licencas.atual(contaId);
    if (dto.modalidade !== 'EVENTO' && !licenca.recursos.permite_ensaio) {
      throw new ForbiddenException(
        'O plano gratuito permite apenas publicar fotos de evento. Faça upgrade para o PRO para publicar ensaios.',
      );
    }

    if (
      dto.modalidade !== 'EVENTO' &&
      dto.visibilidade === 'PRIVADA' &&
      !licenca.recursos.permite_galeria_privada
    ) {
      throw new ForbiddenException(
        'Galeria privada com seleção requer plano PRO ativo.',
      );
    }

    if (
      licenca.recursos.limite_fotos_por_galeria &&
      dto.fotos.length > licenca.recursos.limite_fotos_por_galeria
    ) {
      throw new ForbiddenException(
        `Esta galeria contém ${dto.fotos.length} fotos, excedendo o limite de ${licenca.recursos.limite_fotos_por_galeria} fotos por galeria do seu plano.`,
      );
    }

    // 2. Validação de cota de armazenamento em GB/MB do plano (quando definido)
    if (licenca.recursos.limite_armazenamento_mb != null) {
      const limiteBytes = BigInt(licenca.recursos.limite_armazenamento_mb) * 1024n * 1024n;

      const galeriaExistente = await this.prisma.galeria.findUnique({
        where: {
          contaId_ensaioIdDesktop: {
            contaId,
            ensaioIdDesktop: dto.ensaioIdDesktop,
          },
        },
        select: { id: true },
      });

      // 2.1 Fotos já gravadas no banco para esta conta (excluindo fotos da galeria atual caso seja atualização/renovação)
      const fotosBanco = await this.prisma.foto.aggregate({
        where: {
          galeria: { contaId },
          ...(galeriaExistente ? { galeriaId: { not: galeriaExistente.id } } : {}),
        },
        _sum: { tamanhoAltaBytes: true },
      });
      const bytesAtuais = BigInt(fotosBanco._sum.tamanhoAltaBytes ?? 0);

      // 2.2 Bytes previstos das fotos deste novo lote
      const bytesNovoLote = dto.fotos.reduce((acc, f) => acc + BigInt(f.tamanhoAltaBytes ?? 0), 0n);

      const bytesTotalPrevisto = bytesAtuais + bytesNovoLote;
      if (bytesTotalPrevisto > limiteBytes) {
        const mbTotal = Number(bytesTotalPrevisto / (1024n * 1024n));
        throw new ForbiddenException(
          `Esta galeria excederá a cota de armazenamento do seu plano (${mbTotal} MB previstos / ${licenca.recursos.limite_armazenamento_mb} MB disponíveis). Faça upgrade para continuar.`,
        );
      }
    }

    // 3. Idempotência por lote: se já CONCLUIDO, devolve o que já foi feito
    const loteExistente = await this.prisma.syncLote.findUnique({
      where: { chaveIdempotencia: dto.chaveIdempotencia },
    });
    if (loteExistente && loteExistente.status === 'CONCLUIDO') {
      return {
        loteId: loteExistente.id,
        galeriaId: loteExistente.galeriaId ?? '',
        totalItens: loteExistente.totalItens,
        urlsUpload: [],
      };
    }

    // 4. Obter conta para prefixo de código de acesso e link
    const conta = await this.prisma.conta.findUniqueOrThrow({
      where: { id: contaId },
      select: { slug: true },
    });

    // 4. Slug da galeria
    let slugBase = slugificar(dto.slug || dto.titulo) || 'galeria';
    let slug = slugBase;
    let contador = 1;
    while (true) {
      const conflito = await this.prisma.galeria.findFirst({
        where: {
          contaId,
          slug,
          ensaioIdDesktop: { not: dto.ensaioIdDesktop },
        },
      });
      if (!conflito) break;
      slug = `${slugBase}-${++contador}`;
    }

    // 5. Visibilidade e código de acesso
    // entrega vai sem marca d'água: nunca fica aberta na vitrine, nem em evento
    const visibilidade =
      dto.modoVenda === 'ENTREGA'
        ? 'PRIVADA'
        : (dto.visibilidade ??
          (dto.modalidade === 'EVENTO' ? 'PUBLICA' : 'PRIVADA'));

    // privada sem código (nova, ou pública que virou privada): gera um
    const atual = await this.prisma.galeria.findUnique({
      where: {
        contaId_ensaioIdDesktop: { contaId, ensaioIdDesktop: dto.ensaioIdDesktop },
      },
      select: { codigoAcesso: true },
    });
    let codigoAcesso = dto.codigoAcesso ?? atual?.codigoAcesso ?? undefined;
    if (visibilidade === 'PRIVADA' && !codigoAcesso) {
      codigoAcesso = await this.gerarCodigoAcesso(conta.slug);
    }

    let senhaHash: string | null = null;
    if (dto.senha) {
      senhaHash = await this.senha.hash(dto.senha);
    }

    // 6. Upsert da galeria
    const galeria = await this.prisma.galeria.upsert({
      where: {
        contaId_ensaioIdDesktop: {
          contaId,
          ensaioIdDesktop: dto.ensaioIdDesktop,
        },
      },
      create: {
        contaId,
        ensaioIdDesktop: dto.ensaioIdDesktop,
        titulo: dto.titulo,
        descricao: dto.descricao,
        slug,
        modalidade: dto.modalidade,
        visibilidade,
        categoria: dto.categoria,
        modoVenda: dto.modoVenda,
        precoFotoCentavos: dto.precoFotoCentavos,
        fotosIncluidas: dto.fotosIncluidas,
        precoPacoteCentavos: dto.precoPacoteCentavos,
        permiteDownloadGratis: dto.permiteDownloadGratis,
        codigoAcesso,
        senhaHash,
        dataEvento: dto.dataEvento,
        cidade: dto.cidade,
        uf: dto.uf,
        encerraEm: dto.encerraEm,
        status: 'RASCUNHO',
      },
      update: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        modalidade: dto.modalidade,
        visibilidade,
        categoria: dto.categoria,
        modoVenda: dto.modoVenda,
        precoFotoCentavos: dto.precoFotoCentavos,
        fotosIncluidas: dto.fotosIncluidas,
        precoPacoteCentavos: dto.precoPacoteCentavos,
        permiteDownloadGratis: dto.permiteDownloadGratis,
        dataEvento: dto.dataEvento,
        cidade: dto.cidade,
        uf: dto.uf,
        encerraEm: dto.encerraEm,
        ...(codigoAcesso ? { codigoAcesso } : {}),
        ...(senhaHash ? { senhaHash } : {}),
      },
    });

    // 7. Registro ou Atualização do Lote (suporta renovação de URLs para o mesmo lote)
    const lote = loteExistente
      ? await this.prisma.syncLote.update({
          where: { id: loteExistente.id },
          data: {
            tokenApiId,
            galeriaId: galeria.id,
            status: 'RECEBIDO',
            totalItens: dto.fotos.length,
          },
        })
      : await this.prisma.syncLote.create({
          data: {
            contaId,
            tokenApiId,
            galeriaId: galeria.id,
            tipo: 'PUBLICAR',
            chaveIdempotencia: dto.chaveIdempotencia,
            status: 'RECEBIDO',
            totalItens: dto.fotos.length,
          },
        });

    // 8. Gerar URLs pré-assinadas e criar registros de fotos
    const urlsUpload: {
      fotoIdDesktop: string;
      tipo: 'preview' | 'miniatura' | 'alta';
      urlPut: string;
      chave: string;
    }[] = [];

    for (const f of dto.fotos) {
      const previewKey = `previews/${contaId}/${galeria.id}/${f.fotoIdDesktop}.webp`;
      // miniatura da grade (desktop >= 15/10/2026); quem não manda fica sem e a vitrine usa a prévia
      const thumbKey = `previews/${contaId}/${galeria.id}/${f.fotoIdDesktop}.mini.webp`;
      const altaKey =
        f.temAlta !== false ? `originais/${contaId}/${galeria.id}/${f.fotoIdDesktop}.jpg` : null;

      const urlPutPreview = await this.storage.gerarUrlUpload(
        this.storage.bucketPreviews,
        previewKey,
        'image/webp',
      );
      urlsUpload.push({
        fotoIdDesktop: f.fotoIdDesktop,
        tipo: 'preview',
        urlPut: urlPutPreview,
        chave: previewKey,
      });
      urlsUpload.push({
        fotoIdDesktop: f.fotoIdDesktop,
        tipo: 'miniatura',
        urlPut: await this.storage.gerarUrlUpload(this.storage.bucketPreviews, thumbKey, 'image/webp'),
        chave: thumbKey,
      });

      if (altaKey) {
        const urlPutAlta = await this.storage.gerarUrlUpload(
          this.storage.bucketOriginais,
          altaKey,
          'image/jpeg',
          7200,
          f.tamanhoAltaBytes,
        );
        urlsUpload.push({
          fotoIdDesktop: f.fotoIdDesktop,
          tipo: 'alta',
          urlPut: urlPutAlta,
          chave: altaKey,
        });
      }

      await this.prisma.foto.upsert({
        where: {
          galeriaId_fotoIdDesktop: {
            galeriaId: galeria.id,
            fotoIdDesktop: f.fotoIdDesktop,
          },
        },
        create: {
          galeriaId: galeria.id,
          fotoIdDesktop: f.fotoIdDesktop,
          previewKey,
          thumbKey,
          altaKey,
          largura: f.largura,
          altura: f.altura,
          tamanhoAltaBytes: f.tamanhoAltaBytes,
          numeroIdentificacao: f.numeroIdentificacao,
          precoCentavos: f.precoCentavos,
          ordem: f.ordem,
          status: 'ATIVA',
        },
        update: {
          previewKey,
          thumbKey,
          altaKey,
          largura: f.largura,
          altura: f.altura,
          tamanhoAltaBytes: f.tamanhoAltaBytes,
          numeroIdentificacao: f.numeroIdentificacao,
          precoCentavos: f.precoCentavos,
          ordem: f.ordem,
        },
      });
    }

    return {
      loteId: lote.id,
      galeriaId: galeria.id,
      totalItens: dto.fotos.length,
      urlsUpload,
    };
  }

  /** PREFIXO-1234; `codigo_acesso` é único no banco, então confere antes. */
  private async gerarCodigoAcesso(slugConta: string): Promise<string> {
    const prefixo = (slugConta.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'FOTO').toUpperCase();
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const digitos = tentativa < 5 ? 4 : 6;
      const codigo = `${prefixo}-${randomInt(10 ** (digitos - 1), 10 ** digitos)}`;
      const existe = await this.prisma.galeria.findUnique({
        where: { codigoAcesso: codigo },
        select: { id: true },
      });
      if (!existe) return codigo;
    }
    throw new ConflictException('Não foi possível gerar um código de acesso. Tente de novo.');
  }

  async confirmarLote(
    loteId: string,
    contaId: string,
    dto: ConfirmarSyncLoteDto,
    ip?: string,
  ) {
    const lote = await this.prisma.syncLote.findFirst({
      where: { id: loteId, contaId },
      include: {
        galeria: {
          include: { conta: { select: { slug: true } } },
        },
      },
    });

    if (!lote || !lote.galeria) {
      throw new NotFoundException('Lote de sincronização não encontrado');
    }

    // 1. As chaves vêm do registro criado no iniciarLote (nunca do corpo):
    //    assim ninguém aponta uma foto pro arquivo de outra conta no bucket.
    const registros = await this.prisma.foto.findMany({
      where: {
        galeriaId: lote.galeria.id,
        fotoIdDesktop: { in: dto.fotos.map((f) => f.fotoIdDesktop) },
      },
      select: { fotoIdDesktop: true, previewKey: true, thumbKey: true, altaKey: true },
    });
    const chaves = new Map(registros.map((r) => [r.fotoIdDesktop, r]));

    // 2. Valida existência dos arquivos físicos no R2 e mede tamanhos reais
    const tamanhosReais = new Map<string, number>();
    const semMiniatura = new Set<string>();

    for (const f of dto.fotos) {
      const registro = chaves.get(f.fotoIdDesktop);
      if (!registro) {
        throw new BadRequestException(
          `A foto ${f.fotoIdDesktop} não faz parte deste lote.`,
        );
      }

      const previewExiste = await this.storage.verificarObjetoExiste(
        this.storage.bucketPreviews,
        registro.previewKey,
      );
      if (!previewExiste) {
        throw new BadRequestException(
          `Arquivo de prévia da foto ${f.fotoIdDesktop} não foi encontrado no armazenamento.`,
        );
      }

      // miniatura é opcional (desktop antigo não manda): sem ela a grade usa a prévia
      if (
        registro.thumbKey &&
        !(await this.storage.verificarObjetoExiste(this.storage.bucketPreviews, registro.thumbKey))
      ) {
        semMiniatura.add(f.fotoIdDesktop);
      }

      if (registro.altaKey) {
        const tamanhoReal = await this.storage.obterTamanhoObjetoBytes(
          this.storage.bucketOriginais,
          registro.altaKey,
        );
        if (tamanhoReal === null) {
          throw new BadRequestException(
            `Arquivo original em alta da foto ${f.fotoIdDesktop} não foi encontrado no armazenamento.`,
          );
        }
        tamanhosReais.set(f.fotoIdDesktop, tamanhoReal);
      }
    }

    // 3. Recalcula a cota de armazenamento da conta com os tamanhos reais medidos no R2
    const licenca = await this.licencas.atual(contaId);
    if (licenca.recursos.limite_armazenamento_mb != null) {
      const limiteBytes = BigInt(licenca.recursos.limite_armazenamento_mb) * 1024n * 1024n;

      const outrasFotos = await this.prisma.foto.aggregate({
        where: {
          galeria: { contaId },
          galeriaId: { not: lote.galeria.id },
        },
        _sum: { tamanhoAltaBytes: true },
      });
      const bytesOutras = BigInt(outrasFotos._sum.tamanhoAltaBytes ?? 0);

      let bytesDestaGaleria = 0n;
      for (const f of dto.fotos) {
        const tamanho = tamanhosReais.get(f.fotoIdDesktop) ?? f.tamanhoAltaBytes ?? 0;
        bytesDestaGaleria += BigInt(tamanho);
      }

      if (bytesOutras + bytesDestaGaleria > limiteBytes) {
        const mbTotal = Number((bytesOutras + bytesDestaGaleria) / (1024n * 1024n));
        throw new ForbiddenException(
          `Limite de armazenamento do plano excedido após conferência dos arquivos (${mbTotal} MB medidos / ${licenca.recursos.limite_armazenamento_mb} MB contratados). Faça upgrade da conta.`,
        );
      }
    }

    await this.prisma.syncLote.update({
      where: { id: loteId },
      data: { status: 'PROCESSANDO' },
    });

    // 4. Atualiza fotos confirmadas com os tamanhos reais medidos
    for (const f of dto.fotos) {
      const tamanhoFinal = tamanhosReais.get(f.fotoIdDesktop) ?? f.tamanhoAltaBytes ?? undefined;

      await this.prisma.foto.updateMany({
        where: {
          galeriaId: lote.galeria.id,
          fotoIdDesktop: f.fotoIdDesktop,
        },
        data: {
          largura: f.largura ?? undefined,
          altura: f.altura ?? undefined,
          tamanhoAltaBytes: tamanhoFinal,
          ...(semMiniatura.has(f.fotoIdDesktop) ? { thumbKey: null } : {}),
        },
      });
    }

    // Define foto de capa: só vale uma prévia desta galeria
    const previewsDoLote = registros.map((r) => r.previewKey);
    const capaKey =
      dto.capaKey && previewsDoLote.includes(dto.capaKey)
        ? dto.capaKey
        : chaves.get(dto.fotos[0]?.fotoIdDesktop ?? '')?.previewKey;

    const totalFotos = await this.prisma.foto.count({
      where: { galeriaId: lote.galeria.id, status: 'ATIVA' },
    });

    await this.prisma.galeria.update({
      where: { id: lote.galeria.id },
      data: {
        status: 'PUBLICADA',
        publicadaEm: new Date(),
        totalFotos,
        ...(capaKey ? { capaKey } : {}),
      },
    });

    await this.prisma.syncLote.update({
      where: { id: loteId },
      data: {
        status: 'CONCLUIDO',
        itensOk: dto.fotos.length,
        concluidoEm: new Date(),
      },
    });

    await this.auditoria.registrar({
      acao: 'galeria.publicada',
      alvoTipo: 'galeria',
      alvoId: lote.galeria.id,
      atorContaId: contaId,
      ip,
      depois: {
        titulo: lote.galeria.titulo,
        totalFotos,
        status: 'PUBLICADA',
      },
    });

    const linkPublico = `${this.webUrl.replace(/\/$/, '')}/@${lote.galeria.conta.slug}/${lote.galeria.slug}`;

    return {
      loteId: lote.id,
      galeriaId: lote.galeria.id,
      status: 'CONCLUIDO',
      totalFotos,
      linkPublico,
      visibilidade: lote.galeria.visibilidade,
      codigoAcesso: lote.galeria.codigoAcesso,
    };
  }

  async puxarPedidos(contaId: string, desde?: Date) {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        contaId,
        status: 'PAGO',
        ...(desde ? { pagoEm: { gte: desde } } : {}),
      },
      include: {
        itens: {
          include: {
            foto: {
              select: {
                id: true,
                fotoIdDesktop: true,
                numeroIdentificacao: true,
              },
            },
          },
        },
        comprador: {
          select: {
            nome: true,
            email: true,
            whatsapp: true,
          },
        },
      },
      orderBy: { pagoEm: 'desc' },
      take: 100,
    });

    return pedidos.map((p) => ({
      numero: p.numero.toString(),
      galeriaId: p.galeriaId,
      comprador: p.comprador,
      subtotalCentavos: p.subtotalCentavos,
      totalCentavos: p.totalCentavos,
      repasseCentavos: p.repasseCentavos,
      pagoEm: p.pagoEm?.toISOString(),
      itens: p.itens.map((i) => ({
        fotoIdDesktop: i.foto.fotoIdDesktop,
        numeroIdentificacao: i.foto.numeroIdentificacao,
        precoCentavos: i.precoCentavos,
      })),
    }));
  }
}
