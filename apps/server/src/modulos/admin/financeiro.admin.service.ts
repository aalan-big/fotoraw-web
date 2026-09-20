import { HttpStatus, Injectable } from '@nestjs/common';
import { DominioExcecao, NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta, Prisma } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Contexto } from '../auth/auth.service.js';
import type {
  FalhaRepasseDto,
  GerarRepasseDto,
  ListarRepassesDto,
  PagarRepasseDto,
  PeriodoDto,
} from './dto/financeiro.dto.js';

export class SemSaldoExcecao extends DominioExcecao {
  constructor(saldo: number) {
    super(
      'SEM_SALDO',
      saldo <= 0
        ? 'Esta conta não tem saldo a repassar'
        : `O valor pedido passa do saldo em aberto (${reais(saldo)})`,
    );
  }
}
export class RepasseJaAbertoExcecao extends DominioExcecao {
  constructor() {
    super(
      'REPASSE_JA_ABERTO',
      'Já existe um repasse em aberto pra esta conta. Pague ou marque como falho antes de gerar outro',
      HttpStatus.CONFLICT,
    );
  }
}
export class RepasseEncerradoExcecao extends DominioExcecao {
  constructor(status: string) {
    super('REPASSE_ENCERRADO', `Este repasse já está ${status.toLowerCase()}`);
  }
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Dinheiro da plataforma — docs/banco-de-dados.md §3.5.
 *
 * Vendas: cada pedido PAGO guarda `total`, `comissao` (nossa), `taxaProvedor` e `repasse`
 * (o que é do fotógrafo). Enquanto não há split automático no provedor, o repasse é uma
 * fila manual: **saldo da conta = Σ repasse dos pedidos pagos − Σ repasses já gerados
 * (abertos, solicitados ou pagos)**. Não é coluna: é calculado aqui, sempre.
 */
@Injectable()
export class FinanceiroAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Painel do período: vendas, comissão, taxas, assinaturas recebidas, série por dia, top fotógrafos. */
  async resumo(periodo: PeriodoDto) {
    const { de, ate } = janela(periodo);
    const pagos: Prisma.PedidoWhereInput = { status: 'PAGO', pagoEm: { gte: de, lt: ate } };

    const [vendas, estornos, faturas, porDia, porConta, saldos] = await Promise.all([
      this.prisma.pedido.aggregate({
        where: pagos,
        _count: { _all: true },
        _sum: {
          totalCentavos: true,
          comissaoCentavos: true,
          taxaProvedorCentavos: true,
          repasseCentavos: true,
        },
      }),
      this.prisma.pedido.aggregate({
        where: { status: 'ESTORNADO', atualizadoEm: { gte: de, lt: ate } },
        _count: { _all: true },
        _sum: { totalCentavos: true },
      }),
      this.prisma.fatura.aggregate({
        where: { status: 'PAGA', pagaEm: { gte: de, lt: ate } },
        _count: { _all: true },
        _sum: { valorCentavos: true },
      }),
      this.prisma.$queryRaw<{ dia: Date; pedidos: bigint; total: bigint; comissao: bigint }[]>`
        SELECT date_trunc('day', pago_em)::date AS dia,
               count(*)                         AS pedidos,
               sum(total_centavos)              AS total,
               sum(comissao_centavos)           AS comissao
        FROM pedidos
        WHERE status = 'pago' AND pago_em >= ${de} AND pago_em < ${ate}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.pedido.groupBy({
        by: ['contaId'],
        where: pagos,
        _count: { _all: true },
        _sum: { totalCentavos: true, comissaoCentavos: true, repasseCentavos: true },
        orderBy: { _sum: { totalCentavos: 'desc' } },
        take: 10,
      }),
      this.saldos(),
    ]);

    const contas = porConta.length
      ? await this.prisma.conta.findMany({
          where: { id: { in: porConta.map((c) => c.contaId) } },
          select: { id: true, nome: true, slug: true },
        })
      : [];
    const nomeDe = new Map(contas.map((c) => [c.id, c]));

    return {
      periodo: { de, ate: new Date(ate.getTime() - 1) },
      vendas: {
        pedidos: vendas._count._all,
        totalCentavos: vendas._sum.totalCentavos ?? 0,
        comissaoCentavos: vendas._sum.comissaoCentavos ?? 0,
        taxasCentavos: vendas._sum.taxaProvedorCentavos ?? 0,
        repasseCentavos: vendas._sum.repasseCentavos ?? 0,
        estornos: estornos._count._all,
        estornadoCentavos: estornos._sum.totalCentavos ?? 0,
      },
      assinaturas: {
        faturasPagas: faturas._count._all,
        recebidoCentavos: faturas._sum.valorCentavos ?? 0,
      },
      aRepassar: {
        contas: saldos.filter((s) => s.saldoCentavos > 0).length,
        totalCentavos: saldos.reduce((t, s) => t + Math.max(0, s.saldoCentavos), 0),
        repassesAbertos: saldos.reduce((t, s) => t + s.repassesAbertos, 0),
      },
      porDia: porDia.map((d) => ({
        dia: d.dia,
        pedidos: Number(d.pedidos),
        totalCentavos: Number(d.total),
        comissaoCentavos: Number(d.comissao),
      })),
      porConta: porConta.map((c) => ({
        conta: nomeDe.get(c.contaId) ?? { id: c.contaId, nome: '?', slug: '' },
        pedidos: c._count._all,
        totalCentavos: c._sum.totalCentavos ?? 0,
        comissaoCentavos: c._sum.comissaoCentavos ?? 0,
        repasseCentavos: c._sum.repasseCentavos ?? 0,
      })),
    };
  }

  /**
   * Saldo por fotógrafo: quanto ele já vendeu, quanto foi repassado e quanto falta.
   * Só quem já vendeu ou já teve repasse aparece.
   */
  async saldos() {
    const [vendido, repassado, abertos] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['contaId'],
        where: { status: 'PAGO' },
        _count: { _all: true },
        _sum: { totalCentavos: true, comissaoCentavos: true, repasseCentavos: true },
        _max: { pagoEm: true },
      }),
      this.prisma.repasse.groupBy({
        by: ['contaId'],
        where: { status: { in: ['ABERTO', 'SOLICITADO', 'PAGO'] } },
        _sum: { valorCentavos: true },
        _max: { pagoEm: true },
      }),
      this.prisma.repasse.groupBy({
        by: ['contaId'],
        where: { status: { in: ['ABERTO', 'SOLICITADO'] } },
        _count: { _all: true },
      }),
    ]);
    const ids = [
      ...new Set([...vendido.map((v) => v.contaId), ...repassado.map((r) => r.contaId)]),
    ];
    if (!ids.length) return [];
    const contas = await this.prisma.conta.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        nome: true,
        slug: true,
        email: true,
        status: true,
        perfil: { select: { chavePix: true } },
      },
    });
    const v = new Map(vendido.map((x) => [x.contaId, x]));
    const r = new Map(repassado.map((x) => [x.contaId, x]));
    const a = new Map(abertos.map((x) => [x.contaId, x._count._all]));
    return contas
      .map((c) => {
        const vend = v.get(c.id);
        const rep = r.get(c.id);
        const devido = vend?._sum.repasseCentavos ?? 0;
        const repassadoCentavos = rep?._sum.valorCentavos ?? 0;
        return {
          conta: { id: c.id, nome: c.nome, slug: c.slug, email: c.email, status: c.status },
          chavePix: c.perfil?.chavePix ?? null,
          pedidosPagos: vend?._count._all ?? 0,
          vendidoCentavos: vend?._sum.totalCentavos ?? 0,
          comissaoCentavos: vend?._sum.comissaoCentavos ?? 0,
          devidoCentavos: devido,
          repassadoCentavos,
          saldoCentavos: devido - repassadoCentavos,
          repassesAbertos: a.get(c.id) ?? 0,
          ultimaVendaEm: vend?._max.pagoEm ?? null,
          ultimoRepasseEm: rep?._max.pagoEm ?? null,
        };
      })
      .sort((x, y) => y.saldoCentavos - x.saldoCentavos);
  }

  async listarRepasses(filtro: ListarRepassesDto) {
    const where: Prisma.RepasseWhereInput = {
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.contaId ? { contaId: filtro.contaId } : {}),
    };
    const [itens, total] = await this.prisma.$transaction([
      this.prisma.repasse.findMany({
        where,
        orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        include: {
          conta: {
            select: { id: true, nome: true, slug: true, perfil: { select: { chavePix: true } } },
          },
        },
      }),
      this.prisma.repasse.count({ where }),
    ]);
    return {
      itens: itens.map(({ conta, ...r }) => ({
        ...r,
        conta: { id: conta.id, nome: conta.nome, slug: conta.slug },
        chavePix: conta.perfil?.chavePix ?? null,
      })),
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  /** Cria o repasse (ABERTO, pix_manual) com o saldo — o Pix em si é feito fora, depois marca pago. */
  async gerarRepasse(admin: Conta, dto: GerarRepasseDto, ctx: Contexto) {
    const saldo = (await this.saldos()).find((s) => s.conta.id === dto.contaId);
    if (!saldo) throw new NaoEncontradoExcecao('Conta com vendas', dto.contaId);
    if (saldo.repassesAbertos > 0) throw new RepasseJaAbertoExcecao();
    const valor = dto.valorCentavos ?? saldo.saldoCentavos;
    if (valor <= 0 || valor > saldo.saldoCentavos) throw new SemSaldoExcecao(saldo.saldoCentavos);

    // período informativo: da 1ª venda ainda não coberta até hoje
    const ultimoRepasse = await this.prisma.repasse.findFirst({
      where: { contaId: dto.contaId, status: { in: ['PAGO', 'SOLICITADO', 'ABERTO'] } },
      orderBy: { periodoFim: 'desc' },
      select: { periodoFim: true },
    });
    const primeiraVenda = await this.prisma.pedido.findFirst({
      where: {
        contaId: dto.contaId,
        status: 'PAGO',
        ...(ultimoRepasse ? { pagoEm: { gt: ultimoRepasse.periodoFim } } : {}),
      },
      orderBy: { pagoEm: 'asc' },
      select: { pagoEm: true },
    });
    const hoje = new Date();
    const repasse = await this.prisma.repasse.create({
      data: {
        contaId: dto.contaId,
        periodoInicio: primeiraVenda?.pagoEm ?? saldo.ultimaVendaEm ?? hoje,
        periodoFim: hoje,
        valorCentavos: valor,
        status: 'ABERTO',
        metodo: 'PIX_MANUAL',
      },
    });
    await this.auditoria.registrar({
      acao: 'repasse.gerar',
      alvoTipo: 'repasse',
      alvoId: repasse.id,
      atorContaId: admin.id,
      ip: ctx.ip,
      depois: { contaId: dto.contaId, valorCentavos: valor, saldoAntes: saldo.saldoCentavos },
    });
    return repasse;
  }

  async pagarRepasse(admin: Conta, id: string, dto: PagarRepasseDto, ctx: Contexto) {
    const r = await this.prisma.repasse.findUnique({ where: { id } });
    if (!r) throw new NaoEncontradoExcecao('Repasse', id);
    if (r.status === 'PAGO') throw new RepasseEncerradoExcecao(r.status);
    const pagoEm = dto.pagoEm ?? new Date();
    const depois = await this.prisma.repasse.update({
      where: { id },
      data: { status: 'PAGO', pagoEm, provedorTransferenciaId: dto.referencia ?? null },
    });
    await this.auditoria.registrar({
      acao: 'repasse.pagar',
      alvoTipo: 'repasse',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { status: r.status },
      depois: {
        status: 'PAGO',
        contaId: r.contaId,
        valorCentavos: r.valorCentavos,
        pagoEm: pagoEm.toISOString(),
        referencia: dto.referencia ?? null,
      },
    });
    return depois;
  }

  /** Pix não saiu (chave errada, conta encerrada…): o valor volta pro saldo em aberto. */
  async falhaRepasse(admin: Conta, id: string, dto: FalhaRepasseDto, ctx: Contexto) {
    const r = await this.prisma.repasse.findUnique({ where: { id } });
    if (!r) throw new NaoEncontradoExcecao('Repasse', id);
    if (r.status === 'PAGO' || r.status === 'FALHOU') throw new RepasseEncerradoExcecao(r.status);
    const depois = await this.prisma.repasse.update({ where: { id }, data: { status: 'FALHOU' } });
    await this.auditoria.registrar({
      acao: 'repasse.falhou',
      alvoTipo: 'repasse',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { status: r.status },
      depois: {
        status: 'FALHOU',
        contaId: r.contaId,
        valorCentavos: r.valorCentavos,
        motivo: dto.motivo,
      },
    });
    return depois;
  }
}

/** [de, ate) em UTC a partir de dias de calendário; padrão = mês atual. */
function janela(p: PeriodoDto): { de: Date; ate: Date } {
  const hoje = new Date();
  const de = p.de
    ? new Date(Date.UTC(p.de.getUTCFullYear(), p.de.getUTCMonth(), p.de.getUTCDate()))
    : new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  const fimDia = p.ate
    ? new Date(Date.UTC(p.ate.getUTCFullYear(), p.ate.getUTCMonth(), p.ate.getUTCDate()))
    : new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  return { de, ate: new Date(fimDia.getTime() + DIA_MS) };
}
function reais(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
