import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import {
  type AlterarStatusGaleriaDto,
  alterarStatusGaleriaSchema,
  type ListarGaleriasDto,
  listarGaleriasSchema,
} from './dto/galerias.dto.js';
import { GaleriasService } from './galerias.service.js';

const uuidSchema = z.uuid();

@Controller('galerias')
@UseGuards(JwtGuard)
export class GaleriasController {
  constructor(private readonly galerias: GaleriasService) {}

  @Get()
  async listar(
    @ContaAtual() conta: Conta,
    @Query(new ZodValidationPipe(listarGaleriasSchema)) filtro: ListarGaleriasDto,
  ) {
    return this.galerias.listar(conta.id, conta.slug, filtro);
  }

  @Get('metricas')
  async metricas(@ContaAtual() conta: Conta) {
    return this.galerias.obterMetricas(conta.id);
  }

  @Get(':id')
  async obterPorId(
    @ContaAtual() conta: Conta,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ) {
    return this.galerias.obterPorId(id, conta.id, conta.slug);
  }

  @Patch(':id/status')
  async alterarStatus(
    @ContaAtual() conta: Conta,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(alterarStatusGaleriaSchema)) dto: AlterarStatusGaleriaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.galerias.alterarStatus(id, conta.id, dto.status, ctx.ip ?? undefined);
  }
}
