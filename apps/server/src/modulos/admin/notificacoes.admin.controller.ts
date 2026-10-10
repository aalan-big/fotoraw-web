import { Body, Controller, Delete, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { NotificacoesService } from '../notificacoes/notificacoes.service.js';
import { SoAdmin } from './admin.guards.js';

const inscricaoSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const cancelarSchema = z.object({ endpoint: z.url().max(1000) });

/** Ativar/desativar notificação no aparelho do admin (tela Segurança). */
@Controller('admin/notificacoes')
@SoAdmin()
export class NotificacoesAdminController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  async estado(@ContaAtual() admin: Conta) {
    return {
      ativo: this.notificacoes.ativo,
      chavePublica: this.notificacoes.ativo ? this.notificacoes.chavePublica : null,
      aparelhos: await this.notificacoes.aparelhos(admin.id),
    };
  }

  @Post('inscrever')
  @HttpCode(204)
  async inscrever(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(inscricaoSchema)) corpo: z.infer<typeof inscricaoSchema>,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.notificacoes.inscrever(admin.id, corpo, userAgent);
  }

  @Delete('inscrever')
  @HttpCode(204)
  async cancelar(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(cancelarSchema)) corpo: z.infer<typeof cancelarSchema>,
  ) {
    await this.notificacoes.cancelar(admin.id, corpo.endpoint);
  }

  /** Manda um aviso de teste só pros aparelhos de quem pediu. */
  @Post('testar')
  async testar(@ContaAtual() admin: Conta) {
    const entregues = await this.notificacoes.avisarAdmins(
      { titulo: 'FotoRAW', corpo: 'Notificações ativadas neste aparelho 🎉', url: '/assinaturas' },
      admin.id,
    );
    return { entregues };
  }
}
