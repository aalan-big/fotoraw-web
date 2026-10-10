import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.js';
import { assinaturaWebhookValida } from '../provedores/mercadopago/assinatura-webhook.js';
import { MercadoPagoWebhookService } from './mercadopago-webhook.service.js';

interface CorpoAviso {
  id?: string | number;
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

/**
 * URL cadastrada no painel do MP (Webhooks → modo de produção):
 * POST https://api.fotoraw.com.br/api/pagamentos/webhooks/mercadopago
 * Sem login: quem prova a origem é a assinatura secreta (MERCADOPAGO_WEBHOOK_SECRET).
 */
@Controller('pagamentos/webhooks')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);
  private readonly segredo: string;
  private readonly producao: boolean;

  constructor(
    private readonly webhooks: MercadoPagoWebhookService,
    config: ConfigService<Env, true>,
  ) {
    this.segredo = config.get('MERCADOPAGO_WEBHOOK_SECRET');
    this.producao = config.get('NODE_ENV') === 'production';
  }

  @Post('mercadopago')
  @HttpCode(200)
  receber(
    @Body() corpo: CorpoAviso,
    @Query() query: Record<string, unknown>,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
  ) {
    const queryData = query.data as { id?: unknown } | undefined;
    const dataId = String(query['data.id'] ?? queryData?.id ?? corpo?.data?.id ?? query.id ?? '');
    const tipo = String(corpo?.type ?? query.type ?? query.topic ?? '');

    // sem segredo configurado só passa fora de produção (dev/teste)
    if (this.segredo || this.producao) {
      const valida = assinaturaWebhookValida({ segredo: this.segredo, xSignature, xRequestId, dataId });
      if (!valida) {
        this.logger.warn(`webhook MP com assinatura inválida (tipo ${tipo}, id ${dataId})`);
        throw new UnauthorizedException();
      }
    }
    if (!tipo || !dataId) return { ok: true, resultado: 'aviso sem tipo/id: ignorado' };

    return this.webhooks.receber({
      tipo,
      dataId,
      eventoRef: corpo?.id !== undefined ? String(corpo.id) : `${tipo}:${dataId}:${xRequestId ?? ''}`,
      payload: JSON.parse(JSON.stringify({ corpo: corpo ?? null, query })),
    });
  }
}
