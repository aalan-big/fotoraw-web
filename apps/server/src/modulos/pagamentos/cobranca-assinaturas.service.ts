import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { DominioExcecao, NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import { EmailService } from '../../infra/email/email.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LicencasService } from '../licencas/licencas.service.js';
import {
  emailPagamentoConfirmado,
  emailPlanoPreVencimento,
  emailPlanoVencido,
} from './emails-cobranca.js';
import { inicioDoDia, somarPeriodo } from './periodo.js';

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

export interface PagamentoDeFatura {
  faturaId: string;
  /** quando o dinheiro entrou; sem data = agora */
  pagaEm?: Date;
  /** `pagaEm` é um instante (webhook/agora) e não um dia digitado no admin */
  pagaEmInstante?: boolean;
  /** id da cobrança no provedor (MP: authorized_payment) — único, impede pagar 2× */
  provedorCobrancaId?: string;
  observacao?: string;
  /** null = sistema (webhook) */
  atorContaId: string | null;
  ip?: string | null;
  /** vai no motivo da licença: "manual", "mercadopago" */
  origem: string;
}

/**
 * Dinheiro entrou: fatura PAGA → período da assinatura = o que a fatura cobre →
 * licença ASSINATURA válida até o fim dele → próxima fatura PENDENTE.
 * Mesma regra pro admin ("marcar paga") e pro webhook do Mercado Pago.
 *
 * Regra do período: a fatura com `vencimento = V` paga o período [V, V + periodicidade).
 * Paga depois do período acabar: o período novo começa no dia do pagamento — ninguém
 * paga por um mês que já passou.
 */
@Injectable()
export class CobrancaAssinaturasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licencas: LicencasService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async registrarPagamento(p: PagamentoDeFatura) {
    const fatura = await this.prisma.fatura.findUnique({
      where: { id: p.faturaId },
      include: {
        assinatura: {
          include: {
            plano: true,
            conta: { select: { id: true, nome: true, email: true } },
          },
        },
      },
    });
    if (!fatura) throw new NaoEncontradoExcecao('Fatura', p.faturaId);
    if (fatura.status !== 'PENDENTE' && fatura.status !== 'VENCIDA') {
      throw new FaturaNaoPendenteExcecao(fatura.status);
    }
    const { assinatura } = fatura;
    if (assinatura.status === 'CANCELADA' || assinatura.status === 'EXPIRADA') {
      throw new AssinaturaEncerradaExcecao(assinatura.status);
    }

    const pagaEm = p.pagaEm ?? new Date();
    let inicio = inicioDoDia(fatura.vencimento);
    let fim = somarPeriodo(inicio, assinatura.plano.periodicidade);
    const diaPagamento = inicioDoDia(pagaEm, !p.pagaEm || !!p.pagaEmInstante);
    if (fim <= diaPagamento) {
      inicio = diaPagamento;
      fim = somarPeriodo(inicio, assinatura.plano.periodicidade);
    }

    await this.prisma.$transaction([
      this.prisma.fatura.update({
        where: { id: fatura.id },
        data: {
          status: 'PAGA',
          pagaEm,
          ...(p.provedorCobrancaId ? { provedorCobrancaId: p.provedorCobrancaId } : {}),
        },
      }),
      this.prisma.assinatura.update({
        where: { id: assinatura.id },
        data: {
          status: 'ATIVA',
          periodoAtualInicio: inicio,
          periodoAtualFim: fim,
          ...(p.observacao ? { observacaoAdmin: p.observacao } : {}),
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
      motivo: `assinatura ${assinatura.plano.codigo} (${p.origem})`,
      emitidaPorId: p.atorContaId ?? undefined,
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
      atorContaId: p.atorContaId,
      ip: p.ip ?? null,
      antes: { status: fatura.status },
      depois: {
        status: 'PAGA',
        pagaEm: pagaEm.toISOString(),
        origem: p.origem,
        provedorCobrancaId: p.provedorCobrancaId ?? null,
        assinaturaId: assinatura.id,
        periodo: [inicio.toISOString(), fim.toISOString()],
        licenca: licenca.chave,
        licencaNova: nova,
        observacao: p.observacao ?? null,
      },
    });

    const fotografoUrl = this.config.get('FOTOGRAFO_URL');
    await this.email.enviar(
      emailPagamentoConfirmado({
        para: assinatura.conta.email,
        nome: assinatura.conta.nome,
        planoNome: assinatura.plano.nome,
        valorFormatado: (fatura.valorCentavos / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }),
        validaAteFormatado: fim.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
        linkPainel: `${fotografoUrl}/plano`,
      }),
    );

    return { assinaturaId: assinatura.id, inicio, fim, licenca, nova };
  }

  /**
   * Dispara e-mails de cobrança para o fotógrafo:
   * 1. "Seu plano vence em 3 dias" (aviso preventivo antes de vencer)
   * 2. "Seu plano venceu" (para planos inadimplentes ou expirados)
   * Usa a tabela auditoria para garantir que cada aviso seja enviado no máximo 1x por ciclo.
   */
  async verificarAvisosVencimento(): Promise<{ avisos3Dias: number; avisosVencidos: number }> {
    const hoje = inicioDoDia(new Date(), true);
    const em3Dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
    const em4Dias = new Date(hoje.getTime() + 4 * 24 * 60 * 60 * 1000);
    const fotografoUrl = this.config.get('FOTOGRAFO_URL');

    // 1. Assinaturas ativas que vencem em aproximadamente 3 dias
    const prestesAVencer = await this.prisma.assinatura.findMany({
      where: {
        status: 'ATIVA',
        periodoAtualFim: { gte: em3Dias, lt: em4Dias },
      },
      include: {
        conta: { select: { id: true, nome: true, email: true } },
        plano: { select: { nome: true } },
      },
    });

    let avisos3Dias = 0;
    for (const a of prestesAVencer) {
      const jaEnviado = await this.prisma.auditoria.findFirst({
        where: {
          acao: 'email.cobranca_pre_vencimento',
          alvoId: a.id,
          criadoEm: { gte: a.periodoAtualInicio },
        },
      });
      if (!jaEnviado) {
        await this.email.enviar(
          emailPlanoPreVencimento({
            para: a.conta.email,
            nome: a.conta.nome,
            planoNome: a.plano.nome,
            dias: 3,
            venceEmFormatado: a.periodoAtualFim.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
            linkPainel: `${fotografoUrl}/plano`,
          }),
        );
        await this.auditoria.registrar({
          acao: 'email.cobranca_pre_vencimento',
          alvoTipo: 'assinatura',
          alvoId: a.id,
          atorContaId: null,
          depois: { email: a.conta.email, periodoAtualFim: a.periodoAtualFim.toISOString() },
        });
        avisos3Dias++;
      }
    }

    // 2. Assinaturas que viraram inadimplentes ou expiraram
    const vencidas = await this.prisma.assinatura.findMany({
      where: {
        status: { in: ['INADIMPLENTE', 'EXPIRADA'] },
      },
      include: {
        conta: { select: { id: true, nome: true, email: true } },
        plano: { select: { nome: true } },
      },
    });

    let avisosVencidos = 0;
    for (const a of vencidas) {
      const jaEnviado = await this.prisma.auditoria.findFirst({
        where: {
          acao: 'email.plano_vencido',
          alvoId: a.id,
          criadoEm: { gte: a.periodoAtualFim },
        },
      });
      if (!jaEnviado) {
        await this.email.enviar(
          emailPlanoVencido({
            para: a.conta.email,
            nome: a.conta.nome,
            planoNome: a.plano.nome,
            linkRenovar: `${fotografoUrl}/plano`,
          }),
        );
        await this.auditoria.registrar({
          acao: 'email.plano_vencido',
          alvoTipo: 'assinatura',
          alvoId: a.id,
          atorContaId: null,
          depois: { email: a.conta.email },
        });
        avisosVencidos++;
      }
    }

    return { avisos3Dias, avisosVencidos };
  }
}
