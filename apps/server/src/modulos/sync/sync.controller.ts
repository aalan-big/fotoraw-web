import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta, TokenApi } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { TokenApiAtual } from '../auth/decorators/token-api-atual.decorator.js';
import { TokenApiGuard } from '../auth/guards/token-api.guard.js';
import {
  type ConfirmarSyncLoteDto,
  confirmarSyncLoteSchema,
  type IniciarSyncLoteDto,
  iniciarSyncLoteSchema,
} from './dto/sync.dto.js';
import { type AlterarPrecosDto, alterarPrecosSchema } from '../galerias/dto/galerias.dto.js';
import { GaleriasService } from '../galerias/galerias.service.js';
import { SyncService } from './sync.service.js';

const uuidSchema = z.uuid();

@Controller('sync')
@UseGuards(TokenApiGuard)
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly galerias: GaleriasService,
  ) {}

  /** "Salvar só os valores" no desktop: muda o preço sem reenviar fotos. */
  @Patch('galerias/:ensaioIdDesktop/precos')
  async alterarPrecos(
    @ContaAtual() conta: Conta,
    @Param('ensaioIdDesktop') ensaioIdDesktop: string,
    @Body(new ZodValidationPipe(alterarPrecosSchema)) dto: AlterarPrecosDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.galerias.alterarPrecosPorEnsaio(ensaioIdDesktop, conta.id, dto, ctx.ip ?? undefined);
  }

  @Post('lotes')
  async iniciarLote(
    @ContaAtual() conta: Conta,
    @TokenApiAtual() tokenApi: TokenApi | undefined,
    @Body(new ZodValidationPipe(iniciarSyncLoteSchema)) dto: IniciarSyncLoteDto,
  ) {
    return this.sync.iniciarLote(conta.id, tokenApi?.id ?? '', dto);
  }

  @Post('lotes/:id/confirmar')
  async confirmarLote(
    @ContaAtual() conta: Conta,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(confirmarSyncLoteSchema)) dto: ConfirmarSyncLoteDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.sync.confirmarLote(id, conta.id, dto, ctx.ip ?? undefined);
  }

  @Get('pedidos')
  async puxarPedidos(
    @ContaAtual() conta: Conta,
    @Query('desde') desde?: string,
  ) {
    const dataDesde = desde ? new Date(desde) : undefined;
    return this.sync.puxarPedidos(conta.id, dataDesde);
  }
}
