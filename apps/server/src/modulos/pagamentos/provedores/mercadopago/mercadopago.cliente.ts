import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DominioExcecao } from '../../../../comum/excecoes/dominio.excecao.js';
import type { Env } from '../../../../config/env.js';

const API = 'https://api.mercadopago.com';

/** Assinatura recorrente no MP (`preapproval`). Só os campos que usamos. */
export interface PreapprovalMp {
  id: string;
  /** pending → authorized (cartão cadastrado) → paused | cancelled */
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | string;
  external_reference?: string | null;
  init_point?: string;
  payer_email?: string;
  next_payment_date?: string | null;
}

/** Cada cobrança de uma assinatura (`authorized_payments`). */
export interface CobrancaRecorrenteMp {
  id: number | string;
  preapproval_id: string;
  /** scheduled | processed | recycling | cancelled */
  status: string;
  transaction_amount?: number;
  debit_date?: string | null;
  date_created?: string;
  payment?: { id?: number | string; status?: string; status_detail?: string } | null;
}

/** Pagamento avulso (venda de foto), criado com o token do vendedor. Só os campos usados. */
export interface PagamentoMp {
  id: number;
  status:
    | 'pending'
    | 'approved'
    | 'authorized'
    | 'in_process'
    | 'in_mediation'
    | 'rejected'
    | 'cancelled'
    | 'refunded'
    | 'charged_back';
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount: number;
  payment_method_id?: string;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  fee_details?: { type: string; amount: number }[];
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
}

export class MercadoPagoIndisponivelExcecao extends DominioExcecao {
  constructor() {
    super(
      'MERCADOPAGO_INDISPONIVEL',
      'Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes.',
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/** O MP recusou o pedido (cartão inválido, token vencido…): a mensagem vai pro fotógrafo. */
export class MercadoPagoRecusouExcecao extends DominioExcecao {
  constructor(
    detalhe: string,
    /** status HTTP que o MP devolveu (404 = recurso não existe lá) */
    readonly statusMp = 400,
  ) {
    super('MERCADOPAGO_RECUSOU', `O Mercado Pago recusou: ${detalhe}`);
  }
}

/**
 * HTTP cru na API do MP com o token da conta do FotoRAW (CNPJ) — é ela que recebe as
 * mensalidades. Sem token (dev/teste) `configurado` é false e quem chama segue sem MP.
 */
@Injectable()
export class MercadoPagoCliente {
  private readonly logger = new Logger(MercadoPagoCliente.name);
  private readonly token: string;

  constructor(config: ConfigService<Env, true>) {
    this.token = config.get('MERCADOPAGO_ACCESS_TOKEN');
  }

  get configurado(): boolean {
    return this.token.trim() !== '';
  }

  /**
   * Assinatura recorrente. Com `card_token_id` (cartão tokenizado pelo Brick no navegador)
   * nasce `authorized` e o MP cobra sozinho — sem login no MP nem e-mail casado.
   */
  criarAssinatura(corpo: {
    reason: string;
    external_reference: string;
    payer_email: string;
    back_url: string;
    auto_recurring: {
      frequency: number;
      frequency_type: 'months';
      transaction_amount: number;
      currency_id: 'BRL';
    };
    card_token_id: string;
    status: 'authorized';
  }): Promise<PreapprovalMp> {
    return this.chamar<PreapprovalMp>('POST', '/preapproval', corpo);
  }

  obterAssinatura(id: string): Promise<PreapprovalMp> {
    return this.chamar<PreapprovalMp>('GET', `/preapproval/${encodeURIComponent(id)}`);
  }

  alterarStatusAssinatura(id: string, status: 'paused' | 'authorized' | 'cancelled') {
    return this.chamar<PreapprovalMp>('PUT', `/preapproval/${encodeURIComponent(id)}`, { status });
  }

  /**
   * Diagnóstico de um token de cartão recusado: só campos sem dado sensível (nada de
   * número completo, titular ou documento). `live_mode: false` = token de teste.
   */
  async resumoDoToken(token: string): Promise<Record<string, unknown> | null> {
    try {
      const t = await this.chamar<Record<string, unknown>>(
        'GET',
        `/v1/card_tokens/${encodeURIComponent(token)}`,
      );
      const campos = [
        'status',
        'live_mode',
        'luhn_validation',
        'require_esc',
        'security_code_length',
        'first_six_digits',
        'card_number_length',
        'date_due',
      ];
      return Object.fromEntries(campos.map((c) => [c, t[c] ?? null]));
    } catch {
      return null;
    }
  }

  /**
   * Venda de foto: o pagamento sai na conta do fotógrafo (`tokenVendedor`, do OAuth) e o
   * MP retém `application_fee` pra conta do FotoRAW. A chave de idempotência evita
   * cobrar duas vezes num clique duplo / reenvio.
   */
  criarPagamento(tokenVendedor: string, corpo: Record<string, unknown>, idempotencia: string) {
    return this.chamar<PagamentoMp>('POST', '/v1/payments', corpo, {
      token: tokenVendedor,
      idempotencia,
    });
  }

  /** Estorno total de uma venda (na conta do fotógrafo; o MP devolve a comissão junto). */
  reembolsar(tokenVendedor: string, id: string, idempotencia: string) {
    return this.chamar<{ id: number; status: string }>(
      'POST',
      `/v1/payments/${encodeURIComponent(id)}/refunds`,
      {},
      { token: tokenVendedor, idempotencia },
    );
  }

  obterPagamento(tokenVendedor: string, id: string): Promise<PagamentoMp> {
    return this.chamar<PagamentoMp>('GET', `/v1/payments/${encodeURIComponent(id)}`, undefined, {
      token: tokenVendedor,
    });
  }

  obterCobranca(id: string): Promise<CobrancaRecorrenteMp> {
    return this.chamar<CobrancaRecorrenteMp>(
      'GET',
      `/authorized_payments/${encodeURIComponent(id)}`,
    );
  }

  private async chamar<T>(
    metodo: string,
    caminho: string,
    corpo?: unknown,
    opcoes: { token?: string; idempotencia?: string } = {},
  ): Promise<T> {
    let resposta: Response;
    try {
      resposta = await fetch(`${API}${caminho}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${opcoes.token ?? this.token}`,
          'Content-Type': 'application/json',
          ...(opcoes.idempotencia ? { 'X-Idempotency-Key': opcoes.idempotencia } : {}),
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (erro) {
      this.logger.error(
        `MP ${metodo} ${caminho}: sem resposta`,
        erro instanceof Error ? erro.message : erro,
      );
      throw new MercadoPagoIndisponivelExcecao();
    }
    if (!resposta.ok) {
      // o corpo de erro do MP não tem dado sensível (mensagem + causa); vai pro log pra diagnóstico
      const detalhe = (await resposta.text()).slice(0, 500);
      this.logger.error(`MP ${metodo} ${caminho}: HTTP ${resposta.status} ${detalhe}`);
      // 4xx = o MP recusou o que mandamos (cartão, token, valor); 5xx/401 = problema nosso/dele
      if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 401) {
        throw new MercadoPagoRecusouExcecao(mensagemDoMp(detalhe), resposta.status);
      }
      throw new MercadoPagoIndisponivelExcecao();
    }
    return (await resposta.json()) as T;
  }
}

/** `{"message":"...","cause":[{"description":"..."}]}` → texto curto. */
function mensagemDoMp(corpo: string): string {
  try {
    const j = JSON.parse(corpo) as { message?: string; cause?: { description?: string }[] };
    return (j.cause?.[0]?.description || j.message || 'pedido inválido').slice(0, 200);
  } catch {
    return 'pedido inválido';
  }
}
