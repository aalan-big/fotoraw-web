import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { DominioExcecao, NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import type {
  Categoria,
  Modalidade,
  ModoVenda,
  Visibilidade,
} from '../../infra/prisma/gerado/client.js';
import { urlPublica } from '../../infra/storage/urls.js';
import { LimitadorTentativas } from '../auth/senha/limitador-tentativas.js';
import { SenhaService } from '../auth/senha/senha.service.js';
import {
  type AbrirGaleriaDto,
  type AcessoPorCodigoDto,
  FOTOS_POR_PAGINA,
} from './dto/abrir-galeria.dto.js';
import type { ListarGaleriasDto } from './dto/listar-galerias.dto.js';
import { GaleriasPublicasRepositorio } from './repositorios/galerias-publicas.repositorio.js';

export interface GaleriaPublica {
  id: string;
  titulo: string;
  slug: string;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  categoria: Categoria;
  dataEvento: Date | null;
  cidade: string | null;
  uf: string | null;
  /** menor preço por foto, em centavos — null quando não vende avulso */
  precoFotoCentavos: number | null;
  /** URL pública da capa (montada a partir da chave no bucket) */
  capaUrl: string | null;
  publicadaEm: Date | null;
  totalFotos: number;
  conta: { nome: string; slug: string };
}

export type SituacaoGaleria = 'ABERTA' | 'PAUSADA' | 'ENCERRADA';

export interface FotoPublica {
  id: string;
  /** prévia com a marca de proteção (bucket público), ~1000 px — foto ampliada */
  url: string | null;
  /** miniatura da grade (~480 px); cai pra prévia em foto enviada sem miniatura */
  miniaturaUrl: string | null;
  largura: number | null;
  altura: number | null;
  numero: string | null;
  /** preço desta foto (a da foto ou o da galeria), em centavos */
  precoCentavos: number | null;
}

export interface GaleriaAberta {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  categoria: Categoria;
  modoVenda: ModoVenda;
  precoFotoCentavos: number | null;
  fotosIncluidas: number | null;
  precoPacoteCentavos: number | null;
  dataEvento: Date | null;
  cidade: string | null;
  uf: string | null;
  capaUrl: string | null;
  publicadaEm: Date | null;
  /** ABERTA vende; PAUSADA mostra sem vender; ENCERRADA não mostra fotos */
  situacao: SituacaoGaleria;
  podeComprar: boolean;
  totalFotos: number;
  fotografo: {
    nome: string;
    slug: string;
    logoUrl: string | null;
    whatsapp: string | null;
    instagram: string | null;
  };
  fotos: { itens: FotoPublica[]; total: number; pagina: number; porPagina: number };
}

const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase();

@Injectable()
export class PublicoService {
  /** código errado por IP: 10 em 15 min — o código tem só 4 dígitos */
  readonly tentativasCodigo = new LimitadorTentativas(10);

  constructor(
    private readonly galerias: GaleriasPublicasRepositorio,
    private readonly senhas: SenhaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get basePreviews() {
    return this.config.get('STORAGE_PREVIEWS_URL_PUBLICA');
  }

  /**
   * A galeria pelo link. PUBLICA e PORTFOLIO abrem direto; PRIVADA exige o
   * código (e a senha, se o fotógrafo definiu).
   */
  async abrirGaleria(
    contaSlug: string,
    slug: string,
    dto: AbrirGaleriaDto,
    ip: string,
    senha?: string,
  ): Promise<GaleriaAberta> {
    const galeria = await this.galerias.buscarPorLink(contaSlug, slug);
    if (!galeria) throw new NaoEncontradoExcecao('Galeria');

    if (galeria.visibilidade === 'PRIVADA') {
      if (!dto.codigo) {
        throw new DominioExcecao(
          'CODIGO_NECESSARIO',
          'Esta galeria é privada. Digite o código que o fotógrafo enviou.',
          HttpStatus.FORBIDDEN,
        );
      }
      await this.conferirAcesso(galeria, dto.codigo, senha, ip);
    }

    const encerrada =
      galeria.status === 'ENCERRADA' || (!!galeria.encerraEm && galeria.encerraEm <= new Date());
    const situacao: SituacaoGaleria = encerrada
      ? 'ENCERRADA'
      : galeria.status === 'PAUSADA'
        ? 'PAUSADA'
        : 'ABERTA';

    const fotos = encerrada
      ? { total: 0, itens: [] }
      : await this.galerias.listarFotos(galeria.id, dto.pagina, FOTOS_POR_PAGINA, dto.numero);

    const { conta } = galeria;
    return {
      id: galeria.id,
      titulo: galeria.titulo,
      slug: galeria.slug,
      descricao: galeria.descricao,
      modalidade: galeria.modalidade,
      visibilidade: galeria.visibilidade,
      categoria: galeria.categoria,
      modoVenda: galeria.modoVenda,
      precoFotoCentavos: galeria.precoFotoCentavos,
      fotosIncluidas: galeria.fotosIncluidas,
      precoPacoteCentavos: galeria.precoPacoteCentavos,
      dataEvento: galeria.dataEvento,
      cidade: galeria.cidade,
      uf: galeria.uf,
      capaUrl: urlPublica(this.basePreviews, galeria.capaKey),
      publicadaEm: galeria.publicadaEm,
      situacao,
      podeComprar: situacao === 'ABERTA' && galeria.modoVenda !== 'ENTREGA',
      totalFotos: galeria.totalFotos,
      fotografo: {
        nome: conta.perfil?.nomeFantasia || conta.nome,
        slug: conta.slug,
        logoUrl: urlPublica(this.basePreviews, conta.perfil?.logoKey ?? null),
        whatsapp: conta.perfil?.whatsapp ?? null,
        instagram: conta.perfil?.instagram ?? null,
      },
      fotos: {
        itens: fotos.itens.map((f) => ({
          id: f.id,
          url: urlPublica(this.basePreviews, f.previewKey),
          miniaturaUrl: urlPublica(this.basePreviews, f.thumbKey ?? f.previewKey),
          largura: f.largura,
          altura: f.altura,
          numero: f.numeroIdentificacao,
          precoCentavos: f.precoCentavos ?? galeria.precoFotoCentavos,
        })),
        total: fotos.total,
        pagina: dto.pagina,
        porPagina: FOTOS_POR_PAGINA,
      },
    };
  }

  /** Quem só tem o código (página /ensaio): devolve pra onde ir. */
  async acessoPorCodigo(dto: AcessoPorCodigoDto, ip: string) {
    this.barrarExcesso(ip);
    const galeria = await this.galerias.buscarPorCodigo(normalizarCodigo(dto.codigo));
    if (!galeria) {
      this.tentativasCodigo.registrarFalha(ip);
      throw new DominioExcecao(
        'CODIGO_INVALIDO',
        'Código não encontrado. Confira a mensagem do fotógrafo.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.conferirAcesso(galeria, dto.codigo, dto.senha, ip);
    return { contaSlug: galeria.conta.slug, galeriaSlug: galeria.slug, codigo: galeria.codigoAcesso };
  }

  private barrarExcesso(ip: string) {
    if (this.tentativasCodigo.bloqueado(ip)) {
      throw new DominioExcecao(
        'MUITAS_TENTATIVAS',
        'Muitas tentativas com código errado. Espere 15 minutos e tente de novo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async conferirAcesso(
    galeria: { codigoAcesso: string | null; senhaHash: string | null },
    codigo: string,
    senha: string | undefined,
    ip: string,
  ) {
    this.barrarExcesso(ip);
    if (!galeria.codigoAcesso || normalizarCodigo(codigo) !== galeria.codigoAcesso) {
      this.tentativasCodigo.registrarFalha(ip);
      throw new DominioExcecao(
        'CODIGO_INVALIDO',
        'Código incorreto. Confira a mensagem do fotógrafo.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (galeria.senhaHash) {
      if (!senha) {
        throw new DominioExcecao(
          'SENHA_NECESSARIA',
          'Esta galeria também tem senha.',
          HttpStatus.FORBIDDEN,
        );
      }
      if (!(await this.senhas.conferir(galeria.senhaHash, senha))) {
        this.tentativasCodigo.registrarFalha(ip);
        throw new DominioExcecao('SENHA_INVALIDA', 'Senha incorreta.', HttpStatus.FORBIDDEN);
      }
    }
  }

  async listarGalerias(dto: ListarGaleriasDto, contaSlug?: string): Promise<GaleriaPublica[]> {
    const linhas = await this.galerias.listarVitrine(dto, contaSlug);
    return linhas.map(({ capaKey, ...g }) => ({ ...g, capaUrl: urlPublica(this.basePreviews, capaKey) }));
  }

  /** fotoraw.com.br/@slug — perfil + o que ele tem na vitrine (eventos e portfólio). */
  async perfilFotografo(slug: string) {
    const conta = await this.galerias.buscarFotografo(slug);
    if (!conta) throw new NaoEncontradoExcecao('Fotógrafo');
    const p = conta.perfil;
    return {
      nome: p?.nomeFantasia || conta.nome,
      slug: conta.slug,
      bio: p?.bio ?? null,
      logoUrl: urlPublica(this.basePreviews, p?.logoKey ?? null),
      capaUrl: urlPublica(this.basePreviews, p?.capaKey ?? null),
      whatsapp: p?.whatsapp ?? null,
      instagram: p?.instagram ?? null,
      site: p?.site ?? null,
      cidade: p?.cidade ?? null,
      uf: p?.uf ?? null,
      galerias: await this.listarGalerias({ limite: 48 }, conta.slug),
    };
  }
}
