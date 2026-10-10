import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { DominioExcecao } from '../../../comum/excecoes/dominio.excecao.js';
import { AssinaturasMercadoPagoService } from '../assinaturas-mercadopago.service.js';
import { MercadoPagoRecusouExcecao } from '../provedores/mercadopago/mercadopago.cliente.js';

export interface AvisoMercadoPago {
  /** subscription_preapproval, subscription_authorized_payment, payment, mp-connect… */
  tipo: string;
  /** id do recurso (vem em `data.id`) */
  dataId: string;
  /** id da notificação (idempotência) */
  eventoRef: string;
  payload: Prisma.InputJsonValue;
}

/** aviso de recurso que o MP diz não existir: depois disso para de tentar */
const DESISTE_DO_404_MS = 2 * 60 * 60 * 1000;

/**
 * Guarda todo aviso em `webhooks_recebidos` (o admin vê em Sistema) e processa na hora.
 * Repetido e já processado: ignora. Falhou: grava o erro e devolve 500 — o MP reenvia
 * a cada 15 min, e o processamento é idempotente (fatura tem `provedor_cobranca_id` único).
 */
@Injectable()
export class MercadoPagoWebhookService {
  private readonly logger = new Logger(MercadoPagoWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assinaturas: AssinaturasMercadoPagoService,
  ) {}

  async receber(aviso: AvisoMercadoPago): Promise<{ ok: true; resultado: string }> {
    const chave = { provedor: 'MERCADOPAGO' as const, eventoRef: aviso.eventoRef };
    let registro = await this.prisma.webhookRecebido.findUnique({
      where: { provedor_eventoRef: chave },
    });
    if (registro?.processadoEm) return { ok: true, resultado: 'repetido' };
    if (!registro) {
      try {
        registro = await this.prisma.webhookRecebido.create({
          data: { ...chave, tipo: aviso.tipo, payload: aviso.payload },
        });
      } catch (erro) {
        // dois reenvios ao mesmo tempo: o outro já gravou
        if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
          return { ok: true, resultado: 'repetido' };
        }
        throw erro;
      }
    }

    try {
      const resultado = await this.processar(aviso);
      await this.prisma.webhookRecebido.update({
        where: { id: registro.id },
        data: { processadoEm: new Date(), erro: null },
      });
      this.logger.log(`MP ${aviso.tipo} ${aviso.dataId}: ${resultado}`);
      return { ok: true, resultado };
    } catch (erro) {
      const mensagem =
        erro instanceof DominioExcecao
          ? (erro.getResponse() as { mensagem: string }).mensagem
          : erro instanceof Error
            ? erro.message
            : String(erro);
      // o MP às vezes avisa de um recurso que a API dele diz não existir (ex.: a cobrança
      // de validação do cartão). Logo após o aviso pode ser só atraso — deixa o MP
      // reenviar; passadas 2 h, desiste pra não ficar em erro pra sempre
      if (
        erro instanceof MercadoPagoRecusouExcecao &&
        erro.statusMp === 404 &&
        Date.now() - registro.criadoEm.getTime() > DESISTE_DO_404_MS
      ) {
        await this.prisma.webhookRecebido.update({
          where: { id: registro.id },
          data: { processadoEm: new Date(), erro: `ignorado: ${mensagem}`.slice(0, 1000) },
        });
        this.logger.warn(`MP ${aviso.tipo} ${aviso.dataId}: ignorado após 2 h (${mensagem})`);
        return { ok: true, resultado: 'ignorado: não existe no Mercado Pago' };
      }
      await this.prisma.webhookRecebido.update({
        where: { id: registro.id },
        data: { erro: mensagem.slice(0, 1000) },
      });
      this.logger.error(`MP ${aviso.tipo} ${aviso.dataId}: ${mensagem}`);
      throw erro;
    }
  }

  private processar(aviso: AvisoMercadoPago): Promise<string> {
    switch (aviso.tipo) {
      case 'subscription_authorized_payment':
        return this.assinaturas.processarCobranca(aviso.dataId);
      case 'subscription_preapproval':
        return this.assinaturas.processarAssinatura(aviso.dataId);
      default:
        // payment (vendas de fotos, ainda não existe), mp-connect, chargebacks…: só registra
        return Promise.resolve(`tipo ${aviso.tipo}: só registrado`);
    }
  }
}
