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

  /** Tudo que o painel 360 precisa, em paralelo. `limite` = quantos eventos por fonte. */
  async materiaPrimaResumo(contaId: string, limite: number) {
    const ha30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // a auditoria das licenças aponta pro id da licença, não da conta
    const [todasLicencas, assinaturas] = await Promise.all([
      this.prisma.licenca.findMany({
        where: { contaId },
        orderBy: { emitidaEm: 'desc' },
        select: { id: true, tipo: true, emitidaEm: true, motivo: true, validaAte: true },
      }),
      this.prisma.assinatura.findMany({ where: { contaId }, select: { id: true } }),
    ]);
    const assinaturaIds = assinaturas.map((a) => a.id);
    const [
      conta,
      galerias,
      armazenamento,
      dispositivos,
      logins,
      galeriasPublicadas,
      vendas,
      vendas30d,
      auditorias,
    ] = await Promise.all([
      this.prisma.conta.findFirst({
        where: { id: contaId, papel: 'FOTOGRAFO' },
        select: {
          id: true,
          nome: true,
          email: true,
          slug: true,
          status: true,
          emailVerificadoEm: true,
          criadoEm: true,
        },
      }),
      this.prisma.galeria.groupBy({
        by: ['status'],
        where: { contaId, excluidoEm: null },
        _count: { _all: true },
        _max: { publicadaEm: true },
      }),
      this.prisma.foto.aggregate({
        where: { galeria: { contaId, excluidoEm: null } },
        _sum: { tamanhoAltaBytes: true },
        _count: { _all: true },
      }),
      this.prisma.dispositivo.findMany({
        where: { contaId },
        orderBy: { ultimoVistoEm: 'desc' },
        select: {
          id: true,
          nome: true,
          criadoEm: true,
          ultimoVistoEm: true,
          tokensApi: { where: { revogadoEm: null }, take: 1, select: { id: true } },
        },
      }),
      // uma família de refresh = um login (as rotações ficam na mesma família)
      this.prisma.sessaoWeb.groupBy({
        by: ['familia'],
        where: { contaId },
        _min: { criadoEm: true },
        orderBy: { _min: { criadoEm: 'desc' } },
        take: limite,
      }),
      this.prisma.galeria.findMany({
        where: { contaId, excluidoEm: null, publicadaEm: { not: null } },
        orderBy: { publicadaEm: 'desc' },
        take: limite,
        select: { id: true, titulo: true, publicadaEm: true, totalFotos: true },
      }),
      this.prisma.pedido.findMany({
        where: { contaId, status: 'PAGO' },
        orderBy: { pagoEm: 'desc' },
        take: limite,
        select: {
          id: true,
          numero: true,
          totalCentavos: true,
          pagoEm: true,
          galeria: { select: { titulo: true } },
        },
      }),
      this.prisma.pedido.aggregate({
        where: { contaId, status: 'PAGO', pagoEm: { gte: ha30d } },
        _count: { _all: true },
        _sum: { totalCentavos: true, comissaoCentavos: true },
      }),
      this.prisma.auditoria.findMany({
        where: {
          OR: [
            { alvoTipo: 'conta', alvoId: contaId },
            { atorContaId: contaId },
            { alvoTipo: 'licenca', alvoId: { in: todasLicencas.map((l) => l.id) } },
            { alvoTipo: 'assinatura', alvoId: { in: assinaturaIds } },
            { alvoTipo: 'repasse', depois: { path: ['contaId'], equals: contaId } },
            // a auditoria da fatura aponta pra fatura; a assinatura vai no `depois`
            ...assinaturaIds.map((id) => ({
              alvoTipo: 'fatura',
              depois: { path: ['assinaturaId'], equals: id },
            })),
          ],
        },
        orderBy: { criadoEm: 'desc' },
        take: limite,
        include: { ator: { select: { nome: true, papel: true } } },
      }),
    ]);
    return {
      conta,
      galerias,
      armazenamento,
      dispositivos,
      logins,
      licencas: todasLicencas.slice(0, limite),
      galeriasPublicadas,
      vendas,
      vendas30d,
      auditorias,
    };
  }

  alterarStatus(id: string, status: Conta['status']): Promise<Conta> {
    return this.prisma.conta.update({ where: { id }, data: { status } });
  }
}
