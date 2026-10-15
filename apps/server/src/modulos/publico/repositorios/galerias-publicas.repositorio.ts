import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { ListarGaleriasDto } from '../dto/listar-galerias.dto.js';

@Injectable()
export class GaleriasPublicasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * O que pode aparecer na vitrine: eventos PUBLICA e ensaios PORTFOLIO,
   * publicados e não expirados. PRIVADA nunca sai daqui.
   */
  listarVitrine({ q, secao, limite }: ListarGaleriasDto, contaSlug?: string) {
    const porSecao: Prisma.GaleriaWhereInput =
      secao === 'eventos'
        ? { modalidade: 'EVENTO', visibilidade: 'PUBLICA' }
        : secao === 'ensaios'
          ? { modalidade: { in: ['ENSAIO_INTERNO', 'ENSAIO_EXTERNO'] }, visibilidade: 'PORTFOLIO' }
          : { visibilidade: { in: ['PUBLICA', 'PORTFOLIO'] } };

    const porBusca: Prisma.GaleriaWhereInput[] = q
      ? [
          {
            OR: [
              { titulo: { contains: q, mode: 'insensitive' } },
              { conta: { nome: { contains: q, mode: 'insensitive' } } },
              { conta: { slug: { contains: q, mode: 'insensitive' } } },
            ],
          },
        ]
      : [];

    return this.prisma.galeria.findMany({
      where: {
        status: 'PUBLICADA',
        excluidoEm: null,
        // conta excluída ou bloqueada some da vitrine junto com as galerias
        conta: {
          excluidoEm: null,
          status: { not: 'BLOQUEADA' },
          ...(contaSlug ? { slug: contaSlug } : {}),
        },
        ...porSecao,
        AND: [{ OR: [{ encerraEm: null }, { encerraEm: { gt: new Date() } }] }, ...porBusca],
      },
      orderBy: { publicadaEm: 'desc' },
      take: limite,
      select: {
        id: true,
        titulo: true,
        slug: true,
        modalidade: true,
        visibilidade: true,
        categoria: true,
        dataEvento: true,
        cidade: true,
        uf: true,
        precoFotoCentavos: true,
        capaKey: true,
        publicadaEm: true,
        totalFotos: true,
        conta: { select: { nome: true, slug: true } },
      },
    });
  }

  /**
   * Uma galeria pelo link (/@conta/slug), em qualquer visibilidade — quem
   * decide se mostra as fotos é o service (privada exige código). Rascunho,
   * excluída ou conta fora do ar = não existe.
   */
  buscarPorLink(contaSlug: string, slug: string) {
    return this.prisma.galeria.findFirst({
      where: {
        slug,
        status: { in: ['PUBLICADA', 'PAUSADA', 'ENCERRADA'] },
        excluidoEm: null,
        conta: { slug: contaSlug, excluidoEm: null, status: { not: 'BLOQUEADA' } },
      },
      select: SELECAO_GALERIA,
    });
  }

  buscarPorCodigo(codigoAcesso: string) {
    return this.prisma.galeria.findFirst({
      where: {
        codigoAcesso,
        status: { in: ['PUBLICADA', 'PAUSADA', 'ENCERRADA'] },
        excluidoEm: null,
        conta: { excluidoEm: null, status: { not: 'BLOQUEADA' } },
      },
      select: SELECAO_GALERIA,
    });
  }

  /** Perfil público do fotógrafo (/@slug). */
  buscarFotografo(slug: string) {
    return this.prisma.conta.findFirst({
      where: { slug, excluidoEm: null, status: { not: 'BLOQUEADA' } },
      select: {
        nome: true,
        slug: true,
        perfil: {
          select: {
            nomeFantasia: true,
            bio: true,
            logoKey: true,
            capaKey: true,
            whatsapp: true,
            instagram: true,
            site: true,
            cidade: true,
            uf: true,
          },
        },
      },
    });
  }

  /** Fotos visíveis, na ordem do desktop; `numero` filtra pela identificação. */
  async listarFotos(galeriaId: string, pagina: number, porPagina: number, numero?: string) {
    const where: Prisma.FotoWhereInput = {
      galeriaId,
      status: 'ATIVA',
      ...(numero ? { numeroIdentificacao: { equals: numero, mode: 'insensitive' } } : {}),
    };
    const [total, itens] = await Promise.all([
      this.prisma.foto.count({ where }),
      this.prisma.foto.findMany({
        where,
        orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: {
          id: true,
          previewKey: true,
          thumbKey: true,
          largura: true,
          altura: true,
          numeroIdentificacao: true,
          precoCentavos: true,
        },
      }),
    ]);
    return { total, itens };
  }
}

const SELECAO_GALERIA = {
  id: true,
  titulo: true,
  slug: true,
  descricao: true,
  modalidade: true,
  visibilidade: true,
  categoria: true,
  modoVenda: true,
  precoFotoCentavos: true,
  fotosIncluidas: true,
  precoPacoteCentavos: true,
  permiteDownloadGratis: true,
  capaKey: true,
  codigoAcesso: true,
  senhaHash: true,
  dataEvento: true,
  cidade: true,
  uf: true,
  status: true,
  publicadaEm: true,
  encerraEm: true,
  totalFotos: true,
  conta: {
    select: {
      nome: true,
      slug: true,
      perfil: {
        select: { nomeFantasia: true, logoKey: true, whatsapp: true, instagram: true, cidade: true, uf: true },
      },
    },
  },
} satisfies Prisma.GaleriaSelect;
