import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { SoAdmin } from './admin.guards.js';
import { ContasAdminService } from './contas.admin.service.js';
import {
  type AlterarStatusContaDto,
  type ListarContasDto,
  alterarStatusContaSchema,
  idSchema,
  listarContasSchema,
} from './dto/contas.dto.js';
import { LicencasAdminService } from './licencas.admin.service.js';

@Controller('admin/contas')
@SoAdmin()
export class ContasAdminController {
  constructor(
    private readonly contas: ContasAdminService,
    private readonly licencas: LicencasAdminService,
  ) {}

  @Get()
  listar(@Query(new ZodValidationPipe(listarContasSchema)) filtro: ListarContasDto) {
    return this.contas.listar(filtro);
  }

  @Get(':id')
  detalhe(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.contas.detalhe(id);
  }

  @Get(':id/licencas')
  licencasDaConta(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.licencas.historico(id);
  }

  @Patch(':id/status')
  alterarStatus(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(alterarStatusContaSchema)) dto: AlterarStatusContaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.contas.alterarStatus(admin, id, dto, ctx);
  }

  @Post(':id/reenviar-verificacao')
  @HttpCode(204)
  async reenviarVerificacao(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Ctx() ctx: Contexto,
  ) {
    await this.contas.reenviarVerificacao(admin, id, ctx);
  }

  @Delete(':id/dispositivos/:dispositivoId')
  @HttpCode(204)
  async revogarDispositivo(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Param('dispositivoId', new ZodValidationPipe(idSchema)) dispositivoId: string,
    @Ctx() ctx: Contexto,
  ) {
    await this.contas.revogarDispositivo(admin, id, dispositivoId, ctx);
  }
}
