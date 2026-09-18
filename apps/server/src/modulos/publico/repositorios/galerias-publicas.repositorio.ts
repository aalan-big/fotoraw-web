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
  listarVitrine({ q, secao, limite }: ListarGaleriasDto) {
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
        conta: { excluidoEm: null, status: { not: 'BLOQUEADA' } },
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
}
