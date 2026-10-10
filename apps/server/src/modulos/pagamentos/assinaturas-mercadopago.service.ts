import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { NotificacoesService } from '../notificacoes/notificacoes.service.js';
import { CobrancaAssinaturasService } from './cobranca-assinaturas.service.js';
import {
  MercadoPagoCliente,
  MercadoPagoIndisponivelExcecao,
} from './provedores/mercadopago/mercadopago.cliente.js';

/**
 * Mensalidade dos planos no cartão, pelas Assinaturas do Mercado Pago (`preapproval`) na
 * conta do FotoRAW. Fluxo: pedido no painel → preapproval `pending` com o id da nossa
 * assinatura em `external_reference` → fotógrafo cadastra o cartão no `init_point` → o MP
 * cobra todo mês e avisa pelo webhook → `processarCobranca` marca a fatura paga.
 * Nada aqui confia no corpo do webhook: sempre relê o recurso na API do MP.
 */
@Injectable()
export class AssinaturasMercadoPagoService {
  private readonly logger = new Logger(AssinaturasMercadoPagoService.name);
  private readonly fotografoUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoCliente,
    private readonly cobranca: CobrancaAssinaturasService,
    private readonly auditoria: AuditoriaService,
    private readonly notificacoes: NotificacoesService,
    config: ConfigService<Env, true>,
  ) {
    this.fotografoUrl = config.get('FOTOGRAFO_URL').replace(/\/$/, '');
  }

  /** Sem token do MP (dev/teste) as assinaturas seguem manuais: o admin marca paga. */
  get ativo(): boolean {
    return this.mp.configurado;
  }

  /**
   * Cria a assinatura no MP e guarda o link do checkout na fatura pendente.
   * Devolve o link (o painel redireciona pra ele).
   */
  async iniciarCheckout(assinaturaId: string): Promise<string | null> {
    if (!this.ativo) return null;
    const a = await this.prisma.assinatura.findUniqueOrThrow({
      where: { id: assinaturaId },
      include: { plano: true, conta: { select: { email: true } } },
    });
    const pre = await this.mp.criarAssinatura({
      reason: `FotoRAW ${a.plano.nome}`,
      external_reference: a.id,
      payer_email: a.conta.email,
      back_url: `${this.fotografoUrl}/plano?retorno=mercadopago`,
      auto_recurring: {
        frequency: a.plano.periodicidade === 'ANUAL' ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: a.plano.precoCentavos / 100,
        currency_id: 'BRL',
      },
      status: 'pending',
    });
    if (!pre.init_point) {
      this.logger.error(`MP criou o preapproval ${pre.id} sem init_point`);
      throw new MercadoPagoIndisponivelExcecao();
    }
    await this.prisma.$transaction([
      this.prisma.assinatura.update({
        where: { id: a.id },
        data: { provedor: 'MERCADOPAGO', provedorAssinaturaId: pre.id },
      }),
      this.prisma.fatura.updateMany({
        where: { assinaturaId: a.id, status: { in: ['PENDENTE', 'VENCIDA'] } },
        data: { urlBoletoPix: pre.init_point },
      }),
    ]);
    return pre.init_point;
  }

  /** Para de cobrar (fotógrafo cancelou a renovação). `paused` dá pra retomar. */
  async pausar(provedorAssinaturaId: string) {
    await this.mp.alterarStatusAssinatura(provedorAssinaturaId, 'paused');
  }

  async retomar(provedorAssinaturaId: string) {
    await this.mp.alterarStatusAssinatura(provedorAssinaturaId, 'authorized');
  }

  /** Pedido que nunca foi pago e foi trocado/desistido: encerra no MP. */
  async cancelarNoProvedor(provedorAssinaturaId: string) {
    await this.mp.alterarStatusAssinatura(provedorAssinaturaId, 'cancelled');
  }

  /** Webhook `subscription_authorized_payment`: uma cobrança mensal mudou. */
  async processarCobranca(cobrancaId: string): Promise<string> {
    const c = await this.mp.obterCobranca(cobrancaId);
    const ref = String(c.id);
    const a = await this.prisma.assinatura.findUnique({
      where: { provedorAssinaturaId: c.preapproval_id },
      include: {
        plano: true,
        conta: { select: { nome: true } },
        faturas: { where: { status: { in: ['PENDENTE', 'VENCIDA'] } }, orderBy: { vencimento: 'asc' } },
      },
    });
    if (!a) return `cobrança ${ref}: preapproval ${c.preapproval_id} não é nosso`;

    if (await this.prisma.fatura.findUnique({ where: { provedorCobrancaId: ref } })) {
      return `cobrança ${ref}: já registrada`;
    }
    if (c.payment?.status !== 'approved') {
      await this.auditoria.registrar({
        acao: 'assinatura.cobranca_nao_aprovada',
        alvoTipo: 'assinatura',
        alvoId: a.id,
        depois: {
          cobranca: ref,
          status: c.status,
          pagamento: c.payment?.status ?? null,
          detalhe: c.payment?.status_detail ?? null,
        },
      });
      // o MP tenta de novo sozinho (recycling); avisa só quando houve tentativa recusada
      if (c.payment?.status === 'rejected') {
        await this.notificacoes.avisarAdmins({
          titulo: 'Cobrança recusada',
          corpo: `${a.conta.nome} · ${a.plano.nome} · ${moeda(c.transaction_amount)} — cartão recusado`,
          url: `/assinaturas/${a.id}`,
        });
      }
      return `cobrança ${ref}: ${c.status}/${c.payment?.status ?? 'sem pagamento'}`;
    }

    // o MP cobrou: paga a fatura em aberto mais antiga; se não há (cancelamento agendado
    // mas o MP cobrou mesmo assim), registra uma do período seguinte — o dinheiro entrou
    const faturaId =
      a.faturas[0]?.id ??
      (
        await this.prisma.fatura.create({
          data: {
            assinaturaId: a.id,
            valorCentavos: Math.round((c.transaction_amount ?? a.plano.precoCentavos / 100) * 100),
            vencimento: a.periodoAtualFim,
          },
        })
      ).id;
    await this.cobranca.registrarPagamento({
      faturaId,
      pagaEm: c.debit_date ? new Date(c.debit_date) : new Date(),
      pagaEmInstante: true,
      provedorCobrancaId: ref,
      atorContaId: null,
      origem: 'mercadopago',
    });
    await this.notificacoes.avisarAdmins({
      titulo: 'Pagamento recebido 💰',
      corpo: `${a.conta.nome} · ${a.plano.nome} · ${moeda(c.transaction_amount ?? a.plano.precoCentavos / 100)}`,
      url: `/assinaturas/${a.id}`,
    });
    return `cobrança ${ref}: fatura ${faturaId} paga`;
  }

  /**
   * Webhook `subscription_preapproval`: a assinatura mudou no MP (cartão cadastrado,
   * pausada, cancelada pelo app do MP). Espelha aqui.
   */
  async processarAssinatura(preapprovalId: string): Promise<string> {
    const pre = await this.mp.obterAssinatura(preapprovalId);
    const a =
      (await this.prisma.assinatura.findUnique({
        where: { provedorAssinaturaId: pre.id },
        include: { faturas: true, plano: true },
      })) ??
      // o aviso pode chegar antes de gravarmos o id do MP: acha pelo external_reference
      (pre.external_reference && /^[0-9a-f-]{36}$/i.test(pre.external_reference)
        ? await this.prisma.assinatura.findUnique({
            where: { id: pre.external_reference },
            include: { faturas: true, plano: true },
          })
        : null);
    if (!a) return `preapproval ${pre.id}: não é nosso`;
    if (a.status === 'CANCELADA' || a.status === 'EXPIRADA') {
      return `preapproval ${pre.id}: assinatura ${a.id} já encerrada`;
    }
    const foiPaga = a.faturas.some((f) => f.status === 'PAGA');
    const emAberto = a.faturas.filter((f) => f.status === 'PENDENTE' || f.status === 'VENCIDA');

    if (pre.status === 'cancelled' || pre.status === 'paused') {
      if (!foiPaga && pre.status === 'cancelled') {
        // pedido que nunca foi pago: morre
        await this.prisma.$transaction([
          this.prisma.fatura.updateMany({
            where: { id: { in: emAberto.map((f) => f.id) } },
            data: { status: 'CANCELADA' },
          }),
          this.prisma.assinatura.update({
            where: { id: a.id },
            data: { status: 'CANCELADA', canceladaEm: new Date() },
          }),
        ]);
      } else if (!a.cancelaNoFimDoPeriodo) {
        // já pago: vale até o fim do período e não renova
        await this.prisma.$transaction([
          this.prisma.fatura.updateMany({
            where: { id: { in: emAberto.map((f) => f.id) } },
            data: { status: 'CANCELADA' },
          }),
          this.prisma.assinatura.update({
            where: { id: a.id },
            data: { cancelaNoFimDoPeriodo: true },
          }),
        ]);
      }
    } else if (pre.status === 'authorized' && a.cancelaNoFimDoPeriodo) {
      // retomada (pelo painel ou pelo app do MP): volta a renovar
      await this.prisma.$transaction([
        this.prisma.assinatura.update({
          where: { id: a.id },
          data: { cancelaNoFimDoPeriodo: false },
        }),
        ...(emAberto.length || a.plano.precoCentavos <= 0
          ? []
          : [
              this.prisma.fatura.create({
                data: {
                  assinaturaId: a.id,
                  valorCentavos: a.plano.precoCentavos,
                  vencimento: a.periodoAtualFim,
                },
              }),
            ]),
      ]);
    }
    if (!a.provedorAssinaturaId) {
      await this.prisma.assinatura.update({
        where: { id: a.id },
        data: { provedor: 'MERCADOPAGO', provedorAssinaturaId: pre.id },
      });
    }
    await this.auditoria.registrar({
      acao: 'assinatura.mercadopago',
      alvoTipo: 'assinatura',
      alvoId: a.id,
      antes: { status: a.status, cancelaNoFimDoPeriodo: a.cancelaNoFimDoPeriodo },
      depois: { preapproval: pre.id, statusMp: pre.status },
    });
    return `preapproval ${pre.id}: ${pre.status}`;
  }
}

function moeda(reais: number | undefined): string {
  return (reais ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
