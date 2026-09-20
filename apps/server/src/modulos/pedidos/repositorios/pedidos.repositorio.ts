import { Injectable } from '@nestjs/common';
import type { Prisma, StatusPedido } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { ExportarCsvDto, ListarPedidosDto } from '../dto/pedidos.dto.js';

@Injectable()
export class PedidosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  private montarWhere(
    contaId: string,
    filtro: {
      status?: StatusPedido;
      galeriaId?: string;
      de?: Date;
      ate?: Date;
      q?: string;
    },
  ): Prisma.PedidoWhereInput {
    const condicoesTexto: Prisma.PedidoWhereInput[] = [];

    if (filtro.q) {
      const qLimpo = filtro.q.replace('#', '').trim();
      const numero = Number(qLimpo);
      if (!isNaN(numero) && Number.isInteger(numero)) {
        condicoesTexto.push({ numero });
      }
      condicoesTexto.push(
        { comprador: { nome: { contains: filtro.q, mode: 'insensitive' } } },
        { comprador: { email: { contains: filtro.q, mode: 'insensitive' } } },
        { galeria: { titulo: { contains: filtro.q, mode: 'insensitive' } } },
      );
    }

    return {
      contaId,
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.galeriaId ? { galeriaId: filtro.galeriaId } : {}),
      ...(filtro.de || filtro.ate
        ? {
            criadoEm: {
              ...(filtro.de ? { gte: filtro.de } : {}),
              ...(filtro.ate ? { lte: filtro.ate } : {}),
            },
          }
        : {}),
      ...(condicoesTexto.length > 0 ? { OR: condicoesTexto } : {}),
    };
  }

  async listar(contaId: string, filtro: ListarPedidosDto) {
    const where = this.montarWhere(contaId, filtro);
    const p = filtro.pagina ?? 1;
    const limite = filtro.limite ?? 20;

    const [itens, total] = await Promise.all([
      this.prisma.pedido.findMany({
        where,
        include: {
          galeria: { select: { id: true, titulo: true, slug: true } },
          comprador: { select: { id: true, nome: true, email: true, whatsapp: true } },
          itens: { select: { id: true } },
          pagamentos: {
            orderBy: { criadoEm: 'desc' },
            take: 1,
            select: { metodo: true, status: true },
          },
        },
        orderBy: [{ criadoEm: 'desc' }],
        skip: (p - 1) * limite,
        take: limite,
      }),
      this.prisma.pedido.count({ where }),
    ]);

    return { itens, total, pagina: p, limite };
  }

  async porNumero(numero: number, contaId: string) {
    return this.prisma.pedido.findFirst({
      where: { numero, contaId },
      include: {
        galeria: { select: { id: true, titulo: true, slug: true } },
        comprador: true,
        itens: {
          include: {
            foto: {
              select: {
                id: true,
                fotoIdDesktop: true,
                previewKey: true,
                numeroIdentificacao: true,
              },
            },
          },
        },
        pagamentos: {
          orderBy: { criadoEm: 'desc' },
        },
        downloads: true,
      },
    });
  }

  async metricas(contaId: string) {
    const [pagosAgregados, totalPedidosPagos, totalPedidosPendentes, totalPedidosCancelados] =
      await Promise.all([
        this.prisma.pedido.aggregate({
          where: { contaId, status: 'PAGO' },
          _sum: {
            totalCentavos: true,
            repasseCentavos: true,
            comissaoCentavos: true,
          },
        }),
        this.prisma.pedido.count({
          where: { contaId, status: 'PAGO' },
        }),
        this.prisma.pedido.count({
          where: { contaId, status: 'AGUARDANDO_PAGAMENTO' },
        }),
        this.prisma.pedido.count({
          where: {
            contaId,
            status: { in: ['CANCELADO', 'EXPIRADO', 'ESTORNADO'] },
          },
        }),
      ]);

    const totalFaturadoCentavos = pagosAgregados._sum.totalCentavos ?? 0;
    const ticketMedioCentavos =
      totalPedidosPagos > 0 ? Math.round(totalFaturadoCentavos / totalPedidosPagos) : 0;

    return {
      totalFaturadoCentavos,
      totalRepasseCentavos: pagosAgregados._sum.repasseCentavos ?? 0,
      totalComissaoCentavos: pagosAgregados._sum.comissaoCentavos ?? 0,
      totalPedidosPagos,
      totalPedidosPendentes,
      totalPedidosCancelados,
      ticketMedioCentavos,
    };
  }

  async listarTodosParaCsv(contaId: string, filtro: ExportarCsvDto) {
    const where = this.montarWhere(contaId, filtro);
    return this.prisma.pedido.findMany({
      where,
      include: {
        galeria: { select: { titulo: true } },
        comprador: { select: { nome: true, email: true, whatsapp: true } },
        itens: { select: { id: true } },
        pagamentos: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
          select: { metodo: true },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 5000,
    });
  }
}
