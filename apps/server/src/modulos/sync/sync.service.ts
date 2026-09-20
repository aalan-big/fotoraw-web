import {
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

    // 2. Idempotência por lote
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

    // 3. Obter conta para prefixo de código de acesso e link
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
    const visibilidade =
      dto.visibilidade ??
      (dto.modalidade === 'EVENTO' ? 'PUBLICA' : 'PRIVADA');

    let codigoAcesso = dto.codigoAcesso;
    if (visibilidade === 'PRIVADA' && !codigoAcesso) {
      const prefixo = (conta.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'FOTO').toUpperCase();
      codigoAcesso = `${prefixo}-${Math.floor(1000 + Math.random() * 9000)}`;
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
        ...(senhaHash ? { senhaHash } : {}),
      },
    });

    // 7. Registro do Lote
    const lote = await this.prisma.syncLote.create({
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
      tipo: 'preview' | 'alta';
      urlPut: string;
      chave: string;
    }[] = [];

    for (const f of dto.fotos) {
      const previewKey = `previews/${contaId}/${galeria.id}/${f.fotoIdDesktop}.webp`;
      const altaKey = `originais/${contaId}/${galeria.id}/${f.fotoIdDesktop}.jpg`;

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

      if (f.temAlta !== false) {
        const urlPutAlta = await this.storage.gerarUrlUpload(
          this.storage.bucketOriginais,
          altaKey,
          'image/jpeg',
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

    await this.prisma.syncLote.update({
      where: { id: loteId },
      data: { status: 'PROCESSANDO' },
    });

    // Atualiza fotos confirmadas se enviadas
    for (const f of dto.fotos) {
      await this.prisma.foto.updateMany({
        where: {
          galeriaId: lote.galeria.id,
          fotoIdDesktop: f.fotoIdDesktop,
        },
        data: {
          previewKey: f.previewKey,
          altaKey: f.altaKey ?? undefined,
          largura: f.largura ?? undefined,
          altura: f.altura ?? undefined,
          tamanhoAltaBytes: f.tamanhoAltaBytes ?? undefined,
        },
      });
    }

    // Define foto de capa
    let capaKey = dto.capaKey;
    if (!capaKey && dto.fotos.length > 0) {
      capaKey = dto.fotos[0]?.previewKey;
    }

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
