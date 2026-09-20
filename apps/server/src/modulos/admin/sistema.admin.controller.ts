import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { SoAdmin } from './admin.guards.js';
import { idSchema } from './dto/contas.dto.js';
import {
  type ListarAuditoriaDto,
  type ListarSyncDto,
  type ListarWebhooksDto,
  listarAuditoriaSchema,
  listarSyncSchema,
  listarWebhooksSchema,
} from './dto/sistema.dto.js';
import { SistemaAdminService } from './sistema.admin.service.js';

/** Auditoria completa + saúde, webhooks e lotes de sync. */
@Controller('admin')
@SoAdmin()
export class SistemaAdminController {
  constructor(private readonly sistema: SistemaAdminService) {}

  @Get('auditoria')
  auditoria(@Query(new ZodValidationPipe(listarAuditoriaSchema)) f: ListarAuditoriaDto) {
    return this.sistema.listarAuditoria(f);
  }

  @Get('auditoria/acoes')
  acoes() {
    return this.sistema.acoesAuditoria();
  }

  @Get('sistema/saude')
  saude() {
    return this.sistema.saudeGeral();
  }

  @Get('sistema/webhooks')
  webhooks(@Query(new ZodValidationPipe(listarWebhooksSchema)) f: ListarWebhooksDto) {
    return this.sistema.listarWebhooks(f);
  }

  @Post('sistema/webhooks/:id/reprocessar')
  @HttpCode(200)
  reprocessar(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Ctx() ctx: Contexto,
  ) {
    return this.sistema.reprocessarWebhook(admin, id, ctx);
  }

  @Get('sistema/sync')
  sync(@Query(new ZodValidationPipe(listarSyncSchema)) f: ListarSyncDto) {
    return this.sistema.listarSync(f);
  }
}
