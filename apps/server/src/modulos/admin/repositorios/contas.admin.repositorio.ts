import { Injectable } from '@nestjs/common';
import type { Conta, Prisma } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { ListarContasDto } from '../dto/contas.dto.js';

/** Leitura ampla das contas pro admin — o que o fotógrafo vê de si mesmo está em `contas`. */
@Injectable()
export class ContasAdminRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  listar(filtro: ListarContasDto) {
    const agora = new Date();
    const licencaAtiva: Prisma.LicencaWhereInput = {
      status: 'ATIVA',
      OR: [{ validaAte: null }, { validaAte: { gt: agora } }],
    };
    const porPlano: Prisma.ContaWhereInput =
      filtro.plano === 'gratuito'
        ? { licencas: { none: licencaAtiva } }
        : filtro.plano === 'trial'
          ? { licencas: { some: { ...licencaAtiva, tipo: 'TRIAL' } } }
          : filtro.plano === 'pro'
            ? { licencas: { some: { ...licencaAtiva, tipo: { not: 'TRIAL' } } } }
            : {};

    const where: Prisma.ContaWhereInput = {
      papel: 'FOTOGRAFO',
      excluidoEm: null,
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.q
        ? {
            OR: [
              { nome: { contains: filtro.q, mode: 'insensitive' } },
              { email: { contains: filtro.q, mode: 'insensitive' } },
              { slug: { contains: filtro.q.replace(/^@/, ''), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...porPlano,
    };

    return this.prisma.$transaction([
      this.prisma.conta.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        select: {
          id: true,
          nome: true,
          email: true,
          slug: true,
          status: true,
          emailVerificadoEm: true,
          criadoEm: true,
          licencas: {
            where: licencaAtiva,
            orderBy: { emitidaEm: 'desc' },
            take: 1,
            select: { tipo: true, validaAte: true, chave: true },
          },
          _count: { select: { galerias: true, dispositivos: true } },
        },
      }),
      this.prisma.conta.count({ where }),
    ]);
  }

  porId(id: string): Promise<Conta | null> {
    return this.prisma.conta.findFirst({ where: { id, papel: 'FOTOGRAFO' } });
  }

  /** Tudo que a tela de detalhe mostra, numa ida só. */
  detalhe(id: string) {
    return this.prisma.conta.findFirst({
      where: { id, papel: 'FOTOGRAFO' },
      include: {
        perfil: true,
        dispositivos: {
          orderBy: { ultimoVistoEm: 'desc' },
          include: {
            tokensApi: {
              where: { revogadoEm: null },
              orderBy: { criadoEm: 'desc' },
              take: 1,
              select: { ultimoUsoEm: true, expiraEm: true },
            },
          },
        },
        galerias: {
          where: { excluidoEm: null },
          orderBy: { publicadaEm: 'desc' },
          take: 20,
          select: {
            id: true,
            titulo: true,
            slug: true,
            modalidade: true,
            visibilidade: true,
            status: true,
            totalFotos: true,
            publicadaEm: true,
          },
        },
        _count: { select: { galerias: true, pedidos: true } },
      },
    });
  }

  /** Vendas pagas: quantidade, total e comissão da plataforma. */
  async resumoVendas(contaId: string) {
    const r = await this.prisma.pedido.aggregate({
      where: { contaId, status: 'PAGO' },
      _count: { _all: true },
      _sum: { totalCentavos: true, comissaoCentavos: true, repasseCentavos: true },
    });
    return {
      pedidosPagos: r._count._all,
      totalCentavos: r._sum.totalCentavos ?? 0,
      comissaoCentavos: r._sum.comissaoCentavos ?? 0,
      repasseCentavos: r._sum.repasseCentavos ?? 0,
    };
  }

  ultimasAuditorias(contaId: string, take = 20) {
    return this.prisma.auditoria.findMany({
      where: { OR: [{ alvoTipo: 'conta', alvoId: contaId }, { atorContaId: contaId }] },
      orderBy: { criadoEm: 'desc' },
      take,
      include: { ator: { select: { id: true, nome: true, papel: true } } },
    });
  }

  alterarStatus(id: string, status: Conta['status']): Promise<Conta> {
    return this.prisma.conta.update({ where: { id }, data: { status } });
  }
}
