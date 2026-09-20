import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { SoAdmin } from './admin.guards.js';
import { idSchema } from './dto/contas.dto.js';
import {
  type EditarPlanoDto,
  type ReemitirPlanoDto,
  editarPlanoSchema,
  reemitirPlanoSchema,
} from './dto/planos.dto.js';
import { PlanosAdminService } from './planos.admin.service.js';

/** Catálogo de planos: ler, editar, reemitir licenças ativas com os limites novos. */
@Controller('admin/planos')
@SoAdmin()
export class PlanosAdminController {
  constructor(private readonly planos: PlanosAdminService) {}

  @Get()
  listar() {
    return this.planos.listar();
  }

  @Patch(':id')
  editar(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(editarPlanoSchema)) dto: EditarPlanoDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.planos.editar(admin, id, dto, ctx);
  }

  @Post(':id/reemitir')
  @HttpCode(200)
  reemitir(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(reemitirPlanoSchema)) dto: ReemitirPlanoDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.planos.reemitir(admin, id, dto, ctx);
  }
}
