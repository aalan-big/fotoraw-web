import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta, TokenApi } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { TokenApiAtual } from '../auth/decorators/token-api-atual.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { TokenApiGuard } from '../auth/guards/token-api.guard.js';
import { BackupsService } from './backups.service.js';
import { type IniciarBackupDto, iniciarBackupSchema } from './dto/backups.dto.js';

const uuid = z.uuid();

/** O desktop: manda o backup (pede link → sobe no bucket → confirma) e restaura. */
@Controller('sync/backups')
@UseGuards(TokenApiGuard)
export class BackupsSyncController {
  constructor(private readonly backups: BackupsService) {}

  @Post()
  async iniciar(
    @ContaAtual() conta: Conta,
    @TokenApiAtual() tokenApi: TokenApi | undefined,
    @Body(new ZodValidationPipe(iniciarBackupSchema)) dto: IniciarBackupDto,
  ) {
    return this.backups.iniciar(conta.id, tokenApi, dto);
  }

  @Post(':id/confirmar')
  @HttpCode(200)
  async confirmar(
    @ContaAtual() conta: Conta,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
  ) {
    return this.backups.confirmar(id, conta.id);
  }

  @Get()
  async listar(@ContaAtual() conta: Conta) {
    return { backups: await this.backups.listar(conta.id) };
  }

  @Get(':id/arquivo')
  async arquivo(
    @ContaAtual() conta: Conta,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Ctx() ctx: Contexto,
  ) {
    return this.backups.linkArquivo(id, conta.id, ctx.ip ?? undefined);
  }
}

/** Painel do fotógrafo: "Backups do desktop" — ver que está sendo feito e baixar um. */
@Controller('me/backups')
@UseGuards(JwtGuard)
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  async listar(@ContaAtual() conta: Conta) {
    return { backups: await this.backups.listar(conta.id) };
  }

  @Get(':id/arquivo')
  async arquivo(
    @ContaAtual() conta: Conta,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Ctx() ctx: Contexto,
  ) {
    return this.backups.linkArquivo(id, conta.id, ctx.ip ?? undefined);
  }
}
