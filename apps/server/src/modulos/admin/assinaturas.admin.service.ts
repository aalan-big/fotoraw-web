import { HttpStatus, Injectable } from '@nestjs/common';
import { DominioExcecao, NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta, Fatura, Plano, Prisma } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Contexto } from '../auth/auth.service.js';
import { LicencasService } from '../licencas/licencas.service.js';
import type {
  CancelarAssinaturaDto,
  CriarAssinaturaDto,
  ListarAssinaturasDto,
  MarcarFaturaPagaDto,
} from './dto/assinaturas.dto.js';

export class AssinaturaJaExisteExcecao extends DominioExcecao {
  constructor() {
    super(
      'ASSINATURA_JA_EXISTE',
      'Esta conta já tem uma assinatura em aberto. Cancele antes de criar outra',
      HttpStatus.CONFLICT,
    );
  }
}
export class PlanoSemCobrancaExcecao extends DominioExcecao {
  constructor() {
    super('PLANO_SEM_COBRANCA', 'Este plano não tem cobrança (gratuito ou fora de venda)');
  }
}
export class FaturaNaoPendenteExcecao extends DominioExcecao {
  constructor(status: string) {
    super(
      'FATURA_NAO_PENDENTE',
      `Esta fatura está ${status.toLowerCase()}, não dá pra marcar paga`,
    );
  }
}
export class AssinaturaEncerradaExcecao extends DominioExcecao {
  constructor(status: string) {
    super('ASSINATURA_ENCERRADA', `Esta assinatura já está ${status.toLowerCase()}`);
  }
}

const RESUMO_CONTA = { select: { id: true, nome: true, email: true, slug: true, status: true } };
const RESUMO_PLANO = {
  select: { id: true, codigo: true, nome: true, precoCentavos: true, periodicidade: true },
};

/**
 * Assinaturas cobradas fora do sistema (Pix, transferência) — docs/fluxos/ambiente-admin.md.
 * A Stripe (passo 6 do fotógrafo) vai gravar nas mesmas tabelas pelos webhooks; a lógica
 * de "fatura paga → período renovado → licença até o fim do período" é a mesma e mora aqui.
 *
 * Regra do período: a fatura com `vencimento = V` paga o período [V, V + periodicidade).
 * Ao pagar, a próxima fatura (vencimento = fim do período) nasce PENDENTE.
 */
@Injectable()
export class AssinaturasAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licencas: LicencasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: ListarAssinaturasDto) {
    await this.marcarVencidas();
    const where: Prisma.AssinaturaWhereInput = {
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.vencidas ? { faturas: { some: { status: 'VENCIDA' } } } : {}),
      ...(filtro.q
        ? {
            conta: {
              OR: [
                { nome: { contains: filtro.q, mode: 'insensitive' } },
                { email: { contains: filtro.q, mode: 'insensitive' } },
                { slug: { contains: filtro.q.replace(/^@/, ''), mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [itens, total, ativas, vencidas] = await this.prisma.$transaction([
      this.prisma.assinatura.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        include: {
          conta: RESUMO_CONTA,
          plano: RESUMO_PLANO,
          faturas: {
            where: { status: { in: ['PENDENTE', 'VENCIDA'] } },
            orderBy: { vencimento: 'asc' },
            take: 1,
            select: { id: true, valorCentavos: true, vencimento: true, status: true },
          },
        },
      }),
      this.prisma.assinatura.count({ where }),
      this.prisma.assinatura.findMany({
        where: { status: 'ATIVA' },
        select: { plano: { select: { precoCentavos: true, periodicidade: true } } },
      }),
      this.prisma.fatura.count({ where: { status: 'VENCIDA' } }),
    ]);
    // MRR: anual entra dividido por 12
    const mrrCentavos = ativas.reduce(
      (soma, a) =>
        soma +
        (a.plano.periodicidade === 'ANUAL'
          ? Math.round(a.plano.precoCentavos / 12)
          : a.plano.precoCentavos),
      0,
    );
    return {
      itens: itens.map(({ faturas, ...a }) => ({ ...a, proximaFatura: faturas[0] ?? null })),
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      numeros: { ativas: ativas.length, mrrCentavos, faturasVencidas: vencidas },
    };
  }

  async detalhe(id: string) {
    await this.marcarVencidas(id);
    const a = await this.prisma.assinatura.findUnique({
      where: { id },
      include: {
        conta: RESUMO_CONTA,
        plano: RESUMO_PLANO,
        faturas: { orderBy: { vencimento: 'desc' } },
        licencas: {
          orderBy: { emitidaEm: 'desc' },
          select: { id: true, chave: true, status: true, validaAte: true, emitidaEm: true },
        },
      },
    });
    if (!a) throw new NaoEncontradoExcecao('Assinatura', id);
    return a;
  }

  async criar(admin: Conta, dto: CriarAssinaturaDto, ctx: Contexto) {
    const [conta, plano, aberta] = await Promise.all([
      this.prisma.conta.findFirst({ where: { id: dto.contaId, papel: 'FOTOGRAFO' } }),
      this.prisma.plano.findUnique({ where: { id: dto.planoId } }),
      this.prisma.assinatura.findFirst({
        where: { contaId: dto.contaId, status: { in: ['TRIAL', 'ATIVA', 'INADIMPLENTE'] } },
      }),
    ]);
    if (!conta) throw new NaoEncontradoExcecao('Conta', dto.contaId);
    if (!plano) throw new NaoEncontradoExcecao('Plano', dto.planoId);
    if (plano.periodicidade === 'NENHUMA' || !plano.ativo) throw new PlanoSemCobrancaExcecao();
    if (aberta) throw new AssinaturaJaExisteExcecao();

    const inicio = dto.inicioEm ? inicioDoDia(dto.inicioEm) : inicioDoDia(new Date(), true);
    const fim = somarPeriodo(inicio, plano.periodicidade);
    const assinatura = await this.prisma.assinatura.create({
      data: {
        contaId: conta.id,
        planoId: plano.id,
        status: 'ATIVA',
        inicioEm: inicio,
        periodoAtualInicio: inicio,
        periodoAtualFim: fim,
        provedor: 'MANUAL',
        origem: 'ADMIN',
        observacaoAdmin: dto.observacao ?? null,
        faturas: { create: { valorCentavos: plano.precoCentavos, vencimento: inicio } },
      },
      include: { faturas: true },
    });
    await this.auditoria.registrar({
      acao: 'assinatura.criar',
      alvoTipo: 'assinatura',
      alvoId: assinatura.id,
      atorContaId: admin.id,
      ip: ctx.ip,
      depois: {
        contaId: conta.id,
        plano: plano.codigo,
        inicioEm: inicio.toISOString(),
        jaPaga: dto.jaPaga,
        observacao: dto.observacao ?? null,
      },
    });
    if (dto.jaPaga) {
      await this.marcarFaturaPaga(admin, assinatura.faturas[0]!.id, {}, ctx);
    }
    return this.detalhe(assinatura.id);
  }

  /**
   * Dinheiro entrou: fatura PAGA → período da assinatura = o que a fatura cobre →
   * licença ASSINATURA válida até o fim dele → próxima fatura PENDENTE.
   */
  async marcarFaturaPaga(admin: Conta, faturaId: string, dto: MarcarFaturaPagaDto, ctx: Contexto) {
    const fatura = await this.prisma.fatura.findUnique({
      where: { id: faturaId },
      include: { assinatura: { include: { plano: true } } },
    });
    if (!fatura) throw new NaoEncontradoExcecao('Fatura', faturaId);
    if (fatura.status !== 'PENDENTE' && fatura.status !== 'VENCIDA') {
      throw new FaturaNaoPendenteExcecao(fatura.status);
    }
    const { assinatura } = fatura;
    if (assinatura.status === 'CANCELADA' || assinatura.status === 'EXPIRADA') {
      throw new AssinaturaEncerradaExcecao(assinatura.status);
    }

    const pagaEm = dto.pagaEm ?? new Date();
    // paga no prazo (ou pouco atrasada): cobre o período original. Paga depois do
    // período acabar: o período novo começa no dia do pagamento — ninguém paga por
    // um mês que já passou.
    let inicio = inicioDoDia(fatura.vencimento);
    let fim = somarPeriodo(inicio, assinatura.plano.periodicidade);
    const diaPagamento = inicioDoDia(pagaEm, !dto.pagaEm);
    if (fim <= diaPagamento) {
      inicio = diaPagamento;
      fim = somarPeriodo(inicio, assinatura.plano.periodicidade);
    }

    await this.prisma.$transaction([
      this.prisma.fatura.update({ where: { id: fatura.id }, data: { status: 'PAGA', pagaEm } }),
      this.prisma.assinatura.update({
        where: { id: assinatura.id },
        data: {
          status: 'ATIVA',
          periodoAtualInicio: inicio,
          periodoAtualFim: fim,
          ...(dto.observacao ? { observacaoAdmin: dto.observacao } : {}),
        },
      }),
      // a próxima só nasce se ninguém pediu cancelamento no fim do período
      ...(assinatura.cancelaNoFimDoPeriodo
        ? []
        : [
            this.prisma.fatura.create({
              data: {
                assinaturaId: assinatura.id,
                valorCentavos: assinatura.plano.precoCentavos,
                vencimento: fim,
              },
            }),
          ]),
    ]);

    const { licenca, nova } = await this.licencas.renovarPorAssinatura({
      assinaturaId: assinatura.id,
      contaId: assinatura.contaId,
      planoId: assinatura.planoId,
      validaAte: fim,
      motivo: `assinatura ${assinatura.plano.codigo} (manual)`,
      emitidaPorId: admin.id,
    });
    // a conta estava suspensa por inadimplência? volta.
    await this.prisma.conta.updateMany({
      where: { id: assinatura.contaId, status: 'SUSPENSA' },
      data: { status: 'ATIVA' },
    });

    await this.auditoria.registrar({
      acao: 'fatura.marcar_paga',
      alvoTipo: 'fatura',
      alvoId: fatura.id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { status: fatura.status },
      depois: {
        status: 'PAGA',
        pagaEm: pagaEm.toISOString(),
        assinaturaId: assinatura.id,
        periodo: [inicio.toISOString(), fim.toISOString()],
        licenca: licenca.chave,
        licencaNova: nova,
        observacao: dto.observacao ?? null,
      },
    });
    return this.detalhe(assinatura.id);
  }

  async cancelar(admin: Conta, id: string, dto: CancelarAssinaturaDto, ctx: Contexto) {
    const a = await this.prisma.assinatura.findUnique({ where: { id } });
    if (!a) throw new NaoEncontradoExcecao('Assinatura', id);
    if (a.status === 'CANCELADA' || a.status === 'EXPIRADA') {
      throw new AssinaturaEncerradaExcecao(a.status);
    }

    // faturas em aberto morrem nos dois casos: ninguém vai cobrar depois do cancelamento
    await this.prisma.fatura.updateMany({
      where: { assinaturaId: id, status: { in: ['PENDENTE', 'VENCIDA'] } },
      data: { status: 'CANCELADA' },
    });
    let licenca: string | null = null;
    if (dto.noFimDoPeriodo) {
      await this.prisma.assinatura.update({
        where: { id },
        data: {
          cancelaNoFimDoPeriodo: true,
          observacaoAdmin: anexar(a.observacaoAdmin, dto.motivo),
        },
      });
    } else {
      await this.prisma.assinatura.update({
        where: { id },
        data: {
          status: 'CANCELADA',
          canceladaEm: new Date(),
          observacaoAdmin: anexar(a.observacaoAdmin, dto.motivo),
        },
      });
      licenca =
        (
          await this.licencas.encerrarDaAssinatura(
            id,
            'REVOGADA',
            `assinatura cancelada: ${dto.motivo}`,
          )
        )?.chave ?? null;
    }
    await this.auditoria.registrar({
      acao: dto.noFimDoPeriodo ? 'assinatura.cancelar_no_fim' : 'assinatura.cancelar',
      alvoTipo: 'assinatura',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { status: a.status },
      depois: {
        motivo: dto.motivo,
        licencaRevogada: licenca,
        periodoAtualFim: a.periodoAtualFim.toISOString(),
      },
    });
    return this.detalhe(id);
  }

  async observacao(admin: Conta, id: string, texto: string, ctx: Contexto) {
    const a = await this.prisma.assinatura.findUnique({ where: { id } });
    if (!a) throw new NaoEncontradoExcecao('Assinatura', id);
    await this.prisma.assinatura.update({
      where: { id },
      data: { observacaoAdmin: texto || null },
    });
    await this.auditoria.registrar({
      acao: 'assinatura.observacao',
      alvoTipo: 'assinatura',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { observacao: a.observacaoAdmin },
      depois: { observacao: texto || null },
    });
    return this.detalhe(id);
  }

  /**
   * Sem job ainda: na leitura, fatura PENDENTE com vencimento passado vira VENCIDA e a
   * assinatura fica INADIMPLENTE (a licença segue até `valida_ate`; suspender de vez é
   * decisão do admin — ou do job de cobrança quando existir).
   */
  private async marcarVencidas(assinaturaId?: string) {
    const hoje = inicioDoDia(new Date(), true);
    const vencidas = await this.prisma.fatura.findMany({
      where: {
        status: 'PENDENTE',
        vencimento: { lt: hoje },
        ...(assinaturaId ? { assinaturaId } : {}),
      },
      select: { id: true, assinaturaId: true },
    });
    if (!vencidas.length) return;
    await this.prisma.$transaction([
      this.prisma.fatura.updateMany({
        where: { id: { in: vencidas.map((f) => f.id) } },
        data: { status: 'VENCIDA' },
      }),
      this.prisma.assinatura.updateMany({
        where: { id: { in: vencidas.map((f) => f.assinaturaId) }, status: 'ATIVA' },
        data: { status: 'INADIMPLENTE' },
      }),
    ]);
  }
}

/**
 * Datas de período/vencimento são "dias de calendário" guardados como DATE (meia-noite
 * UTC no Prisma). `new Date()` vem no fuso local: usa as partes locais pra achar o dia.
 */
function inicioDoDia(d: Date, deLocal = false): Date {
  return deLocal
    ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function somarPeriodo(inicio: Date, periodicidade: Plano['periodicidade']): Date {
  const fim = new Date(inicio);
  if (periodicidade === 'ANUAL') fim.setUTCFullYear(fim.getUTCFullYear() + 1);
  else fim.setUTCMonth(fim.getUTCMonth() + 1);
  return fim;
}
function anexar(atual: string | null, texto: string): string {
  const linha = `${new Date().toLocaleDateString('pt-BR')}: ${texto}`;
  return atual ? `${atual}\n${linha}` : linha;
}
export type FaturaResumo = Pick<Fatura, 'id' | 'valorCentavos' | 'vencimento' | 'status'>;
