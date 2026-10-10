import { Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service.js';

/** Web Push pro celular do admin. Quem avisa (pagamentos) importa daqui. */
@Module({
  providers: [NotificacoesService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
