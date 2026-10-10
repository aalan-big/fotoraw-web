import { Module } from '@nestjs/common';
import { LicencasModule } from '../licencas/licencas.module.js';
import { AssinaturasMercadoPagoService } from './assinaturas-mercadopago.service.js';
import { CobrancaAssinaturasService } from './cobranca-assinaturas.service.js';
import { MercadoPagoCliente } from './provedores/mercadopago/mercadopago.cliente.js';
import { MercadoPagoWebhookController } from './webhooks/mercadopago-webhook.controller.js';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service.js';

/**
 * Dinheiro entrando: mensalidades dos planos (Assinaturas do Mercado Pago na conta do
 * FotoRAW) e, depois, as vendas de fotos com split. Planos e admin usam daqui.
 */
@Module({
  imports: [LicencasModule],
  controllers: [MercadoPagoWebhookController],
  providers: [
    MercadoPagoCliente,
    CobrancaAssinaturasService,
    AssinaturasMercadoPagoService,
    MercadoPagoWebhookService,
  ],
  exports: [CobrancaAssinaturasService, AssinaturasMercadoPagoService],
})
export class PagamentosModule {}
