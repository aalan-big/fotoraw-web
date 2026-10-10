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

export class MercadoPagoIndisponivelExcecao extends DominioExcecao {
  constructor() {
    super(
      'MERCADOPAGO_INDISPONIVEL',
      'Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes.',
      HttpStatus.BAD_GATEWAY,
    );
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
    status: 'pending';
  }): Promise<PreapprovalMp> {
    return this.chamar<PreapprovalMp>('POST', '/preapproval', corpo);
  }

  obterAssinatura(id: string): Promise<PreapprovalMp> {
    return this.chamar<PreapprovalMp>('GET', `/preapproval/${encodeURIComponent(id)}`);
  }

  alterarStatusAssinatura(id: string, status: 'paused' | 'authorized' | 'cancelled') {
    return this.chamar<PreapprovalMp>('PUT', `/preapproval/${encodeURIComponent(id)}`, { status });
  }

  obterCobranca(id: string): Promise<CobrancaRecorrenteMp> {
    return this.chamar<CobrancaRecorrenteMp>('GET', `/authorized_payments/${encodeURIComponent(id)}`);
  }

  private async chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    let resposta: Response;
    try {
      resposta = await fetch(`${API}${caminho}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (erro) {
      this.logger.error(`MP ${metodo} ${caminho}: sem resposta`, erro instanceof Error ? erro.message : erro);
      throw new MercadoPagoIndisponivelExcecao();
    }
    if (!resposta.ok) {
      // o corpo de erro do MP não tem dado sensível (mensagem + causa); vai pro log pra diagnóstico
      const detalhe = (await resposta.text()).slice(0, 500);
      this.logger.error(`MP ${metodo} ${caminho}: HTTP ${resposta.status} ${detalhe}`);
      throw new MercadoPagoIndisponivelExcecao();
    }
    return (await resposta.json()) as T;
  }
}
