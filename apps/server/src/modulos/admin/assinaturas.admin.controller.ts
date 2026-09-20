import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { SoAdmin } from './admin.guards.js';
import { AssinaturasAdminService } from './assinaturas.admin.service.js';
import {
  type CancelarAssinaturaDto,
  type CriarAssinaturaDto,
  type ListarAssinaturasDto,
  type MarcarFaturaPagaDto,
  type ObservacaoDto,
  cancelarAssinaturaSchema,
  criarAssinaturaSchema,
  listarAssinaturasSchema,
  marcarFaturaPagaSchema,
  observacaoSchema,
} from './dto/assinaturas.dto.js';
import { idSchema } from './dto/contas.dto.js';

/** Assinaturas e faturas — manuais hoje, alimentadas pela Stripe depois. */
@Controller('admin')
@SoAdmin()
export class AssinaturasAdminController {
  constructor(private readonly assinaturas: AssinaturasAdminService) {}

  @Get('assinaturas')
  listar(@Query(new ZodValidationPipe(listarAssinaturasSchema)) filtro: ListarAssinaturasDto) {
    return this.assinaturas.listar(filtro);
  }

  @Get('assinaturas/:id')
  detalhe(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.assinaturas.detalhe(id);
  }

  @Post('assinaturas')
  criar(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(criarAssinaturaSchema)) dto: CriarAssinaturaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.assinaturas.criar(admin, dto, ctx);
  }

  @Patch('assinaturas/:id/cancelar')
  cancelar(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(cancelarAssinaturaSchema)) dto: CancelarAssinaturaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.assinaturas.cancelar(admin, id, dto, ctx);
  }

  @Patch('assinaturas/:id/observacao')
  observacao(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(observacaoSchema)) dto: ObservacaoDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.assinaturas.observacao(admin, id, dto.observacao, ctx);
  }

  @Patch('faturas/:id/marcar-paga')
  @HttpCode(200)
  marcarPaga(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(marcarFaturaPagaSchema)) dto: MarcarFaturaPagaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.assinaturas.marcarFaturaPaga(admin, id, dto, ctx);
  }
}
