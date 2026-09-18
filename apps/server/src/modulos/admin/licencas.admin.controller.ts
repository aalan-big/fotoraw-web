import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { SoAdmin } from './admin.guards.js';
import { idSchema } from './dto/contas.dto.js';
import {
  type AlterarStatusLicencaDto,
  type EmitirLicencaDto,
  type ListarLicencasDto,
  alterarStatusLicencaSchema,
  emitirLicencaSchema,
  listarLicencasSchema,
} from './dto/licencas.dto.js';
import { LicencasAdminService } from './licencas.admin.service.js';

@Controller('admin/licencas')
@SoAdmin()
export class LicencasAdminController {
  constructor(private readonly licencas: LicencasAdminService) {}

  @Get()
  listar(@Query(new ZodValidationPipe(listarLicencasSchema)) filtro: ListarLicencasDto) {
    return this.licencas.listar(filtro);
  }

  @Post()
  emitir(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(emitirLicencaSchema)) dto: EmitirLicencaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.licencas.emitir(admin, dto, ctx);
  }

  @Patch(':id/status')
  alterarStatus(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(alterarStatusLicencaSchema)) dto: AlterarStatusLicencaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.licencas.alterarStatus(admin, id, dto, ctx);
  }
}
