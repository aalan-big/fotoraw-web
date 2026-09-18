import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SoAdmin } from './admin.guards.js';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Números da home do admin. Tudo em uma ida ao banco (várias contagens em paralelo). */
@Controller('admin/visao-geral')
@SoAdmin()
export class VisaoGeralAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async visaoGeral() {
    const agora = new Date();
    const em7dias = new Date(agora.getTime() + 7 * DIA_MS);
    const ha30dias = new Date(agora.getTime() - 30 * DIA_MS);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fotografo = { papel: 'FOTOGRAFO' as const, excluidoEm: null };

    const [
      contasAtivas,
      contasSuspensas,
      contasBloqueadas,
      novasNoMes,
      contasSemVerificar,
      licencasPorTipo,
      trialsVencendo,
      assinaturasAtivas,
      vendasMes,
      repassesAbertos,
      webhooksComErro,
      dispositivosConectados,
      galeriasNoAr,
      ultimasContas,
      ultimasAuditorias,
    ] = await Promise.all([
      this.prisma.conta.count({ where: { ...fotografo, status: 'ATIVA' } }),
      this.prisma.conta.count({ where: { ...fotografo, status: 'SUSPENSA' } }),
      this.prisma.conta.count({ where: { ...fotografo, status: 'BLOQUEADA' } }),
      this.prisma.conta.count({ where: { ...fotografo, criadoEm: { gte: ha30dias } } }),
      this.prisma.conta.count({ where: { ...fotografo, emailVerificadoEm: null } }),
      this.prisma.licenca.groupBy({
        by: ['tipo'],
        where: { status: 'ATIVA', OR: [{ validaAte: null }, { validaAte: { gt: agora } }] },
        _count: { _all: true },
      }),
      this.prisma.licenca.count({
        where: { status: 'ATIVA', tipo: 'TRIAL', validaAte: { gt: agora, lte: em7dias } },
      }),
      this.prisma.assinatura.count({ where: { status: 'ATIVA' } }),
      this.prisma.pedido.aggregate({
        where: { status: 'PAGO', pagoEm: { gte: inicioMes } },
        _count: { _all: true },
        _sum: { totalCentavos: true, comissaoCentavos: true },
      }),
      this.prisma.repasse.aggregate({
        where: { status: { in: ['ABERTO', 'SOLICITADO'] } },
        _count: { _all: true },
        _sum: { valorCentavos: true },
      }),
      this.prisma.webhookRecebido.count({ where: { erro: { not: null }, processadoEm: null } }),
      this.prisma.tokenApi.count({
        where: { revogadoEm: null, OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] },
      }),
      this.prisma.galeria.count({ where: { status: 'PUBLICADA', excluidoEm: null } }),
      this.prisma.conta.findMany({
        where: fotografo,
        orderBy: { criadoEm: 'desc' },
        take: 5,
        select: { id: true, nome: true, slug: true, email: true, criadoEm: true, emailVerificadoEm: true },
      }),
      this.prisma.auditoria.findMany({
        orderBy: { criadoEm: 'desc' },
        take: 10,
        include: { ator: { select: { id: true, nome: true, papel: true } } },
      }),
    ]);

    const licencas = Object.fromEntries(licencasPorTipo.map((l) => [l.tipo, l._count._all]));
    return {
      contas: {
        ativas: contasAtivas,
        suspensas: contasSuspensas,
        bloqueadas: contasBloqueadas,
        novasNos30Dias: novasNoMes,
        semVerificarEmail: contasSemVerificar,
      },
      licencas: {
        trial: licencas.TRIAL ?? 0,
        assinatura: licencas.ASSINATURA ?? 0,
        cortesia: licencas.CORTESIA ?? 0,
        vitalicia: licencas.VITALICIA ?? 0,
        trialsVencendoEm7Dias: trialsVencendo,
      },
      assinaturasAtivas,
      vendasMes: {
        pedidos: vendasMes._count._all,
        totalCentavos: vendasMes._sum.totalCentavos ?? 0,
        comissaoCentavos: vendasMes._sum.comissaoCentavos ?? 0,
      },
      repassesAbertos: {
        quantidade: repassesAbertos._count._all,
        valorCentavos: repassesAbertos._sum.valorCentavos ?? 0,
      },
      webhooksComErro,
      dispositivosConectados,
      galeriasNoAr,
      ultimasContas: ultimasContas.map((c) => ({ ...c, emailVerificado: c.emailVerificadoEm !== null })),
      ultimasAuditorias,
    };
  }
}
