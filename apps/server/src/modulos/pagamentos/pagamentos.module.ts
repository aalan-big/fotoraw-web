import { Module } from '@nestjs/common';
import { LicencasModule } from '../licencas/licencas.module.js';
import { NotificacoesModule } from '../notificacoes/notificacoes.module.js';
import { AssinaturasMercadoPagoService } from './assinaturas-mercadopago.service.js';
import { CobrancaAssinaturasService } from './cobranca-assinaturas.service.js';
import { MercadoPagoCliente } from './provedores/mercadopago/mercadopago.cliente.js';
import { RotinaCobrancaService } from './rotina-cobranca.service.js';
import { CredenciaisVendedorService } from './vendas/credenciais-vendedor.service.js';
import { VendasController } from './vendas/vendas.controller.js';
import { VendasService } from './vendas/vendas.service.js';
import { MercadoPagoWebhookController } from './webhooks/mercadopago-webhook.controller.js';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service.js';

/**
 * Dinheiro entrando: mensalidades dos planos (Assinaturas do Mercado Pago na conta do
 * FotoRAW) e, depois, as vendas de fotos com split. Planos e admin usam daqui.
 */
@Module({
  imports: [LicencasModule, NotificacoesModule],
  controllers: [MercadoPagoWebhookController, VendasController],
  providers: [
    MercadoPagoCliente,
    CobrancaAssinaturasService,
    AssinaturasMercadoPagoService,
    MercadoPagoWebhookService,
    RotinaCobrancaService,
    CredenciaisVendedorService,
    VendasService,
  ],
  exports: [
    CredenciaisVendedorService,
    VendasService,CobrancaAssinaturasService, AssinaturasMercadoPagoService, RotinaCobrancaService],
})
export class PagamentosModule {}
