import { Injectable } from '@nestjs/common';
import type { Prisma, StatusGaleria } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { ListarGaleriasDto } from '../dto/galerias.dto.js';

@Injectable()
export class GaleriasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(contaId: string, filtro: ListarGaleriasDto) {
    const where: Prisma.GaleriaWhereInput = {
      contaId,
      excluidoEm: null,
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.modalidade ? { modalidade: filtro.modalidade } : {}),
      ...(filtro.q
        ? {
            OR: [
              { titulo: { contains: filtro.q, mode: 'insensitive' } },
              { slug: { contains: filtro.q, mode: 'insensitive' } },
              { codigoAcesso: { contains: filtro.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const p = filtro.pagina ?? 1;
    const limite = filtro.limite ?? 20;
    const [itens, total] = await Promise.all([
      this.prisma.galeria.findMany({
        where,
        orderBy: [{ criadoEm: 'desc' }, { atualizadoEm: 'desc' }],
        skip: (p - 1) * limite,
        take: limite,
      }),
      this.prisma.galeria.count({ where }),
    ]);

    return { itens, total, pagina: p, limite };
  }

  async porId(id: string, contaId: string) {
    return this.prisma.galeria.findFirst({
      where: { id, contaId, excluidoEm: null },
      include: {
        fotos: {
          orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
        },
      },
    });
  }

  async porEnsaioDesktop(contaId: string, ensaioIdDesktop: string) {
    return this.prisma.galeria.findUnique({
      where: {
        contaId_ensaioIdDesktop: {
          contaId,
          ensaioIdDesktop,
        },
      },
    });
  }

  async atualizarStatus(id: string, contaId: string, status: StatusGaleria) {
    return this.prisma.galeria.updateMany({
      where: { id, contaId },
      data: { status },
    });
  }

  async metricas(contaId: string) {
    const [totalGalerias, totalFotosAgregadas, totalVendasAgregadas] = await Promise.all([
      this.prisma.galeria.count({
        where: { contaId, excluidoEm: null },
      }),
      this.prisma.galeria.aggregate({
        where: { contaId, excluidoEm: null },
        _sum: { totalFotos: true },
      }),
      this.prisma.galeria.aggregate({
        where: { contaId, excluidoEm: null },
        _sum: { totalVendasCentavos: true },
      }),
    ]);

    return {
      totalGalerias,
      totalFotos: totalFotosAgregadas._sum.totalFotos ?? 0,
      totalVendasCentavos: totalVendasAgregadas._sum.totalVendasCentavos ?? 0,
    };
  }
}
