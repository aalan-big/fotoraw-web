import { Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service.js';
import { VigiaDiscoService } from './vigia-disco.service.js';

/** Web Push pro celular do admin. Quem avisa (pagamentos) importa daqui. */
@Module({
  providers: [NotificacoesService, VigiaDiscoService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
