import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { ListarGaleriasDto } from '../dto/listar-galerias.dto.js';

@Injectable()
export class GaleriasPublicasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  /** Galerias de EVENTO publicadas, mais recentes primeiro. Privadas nunca aparecem aqui. */
  listarPublicadas({ q, limite }: ListarGaleriasDto) {
    return this.prisma.galeria.findMany({
      where: {
        tipo: 'EVENTO',
        status: 'PUBLICADA',
        OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
        ...(q
          ? {
              AND: {
                OR: [
                  { titulo: { contains: q, mode: 'insensitive' } },
                  { conta: { nome: { contains: q, mode: 'insensitive' } } },
                  { conta: { slug: { contains: q, mode: 'insensitive' } } },
                ],
              },
            }
          : {}),
      },
      orderBy: { publicadaEm: 'desc' },
      take: limite,
      select: {
        id: true,
        titulo: true,
        slug: true,
        tipo: true,
        capaUrl: true,
        publicadaEm: true,
        conta: { select: { nome: true, slug: true } },
        _count: { select: { fotos: true } },
      },
    });
  }
}
