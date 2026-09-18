import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { limparCookieSessao, responderSessao } from '../auth/sessao-cookie.js';
import { ContasService } from './contas.service.js';
import { type AlterarSenhaDto, alterarSenhaSchema } from './dto/alterar-senha.dto.js';
import { type AtualizarContaDto, atualizarContaSchema } from './dto/atualizar-conta.dto.js';
import { type ExcluirContaDto, excluirContaSchema } from './dto/excluir-conta.dto.js';
import { type PerfilDto, perfilSchema } from './dto/perfil.dto.js';

const uuid = z.uuid();

/** A conta logada (web). Tudo aqui exige JWT. */
@Controller('me')
@UseGuards(JwtGuard)
export class ContasController {
  private readonly cookieSeguro: boolean;

  constructor(
    private readonly contas: ContasService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSeguro = config.get('NODE_ENV') === 'production';
  }

  @Get()
  eu(@ContaAtual() conta: Conta) {
    return this.contas.eu(conta);
  }

  @Patch()
  atualizar(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(atualizarContaSchema)) dto: AtualizarContaDto,
  ) {
    return this.contas.atualizar(conta, dto);
  }

  /** Troca a senha e já devolve sessão nova (as outras caem). */
  @Put('senha')
  @HttpCode(200)
  async alterarSenha(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(alterarSenhaSchema)) dto: AlterarSenhaDto,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessao = await this.contas.alterarSenha(conta, dto.senhaAtual, dto.novaSenha, ctx);
    return responderSessao(res, sessao, this.cookieSeguro);
  }

  @Get('perfil')
  perfil(@ContaAtual() conta: Conta) {
    return this.contas.perfil(conta);
  }

  @Put('perfil')
  salvarPerfil(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(perfilSchema)) dto: PerfilDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.contas.salvarPerfil(conta, dto, ctx);
  }

  @Get('dispositivos')
  dispositivos(@ContaAtual() conta: Conta) {
    return this.contas.listarDispositivos(conta);
  }

  @Delete('dispositivos/:id')
  @HttpCode(204)
  async revogarDispositivo(
    @ContaAtual() conta: Conta,
    @Param('id', new ZodValidationPipe(uuid)) id: string,
    @Ctx() ctx: Contexto,
  ) {
    await this.contas.revogarDispositivo(conta, id, ctx);
  }

  /** POST e não DELETE porque leva a senha no corpo. */
  @Post('excluir')
  @HttpCode(204)
  async excluir(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(excluirContaSchema)) dto: ExcluirContaDto,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.contas.excluir(conta, dto.senha, ctx);
    limparCookieSessao(res);
  }
}
