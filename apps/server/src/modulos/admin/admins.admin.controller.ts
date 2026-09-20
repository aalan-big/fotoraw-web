import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { Sem2FA, SoAdmin } from './admin.guards.js';
import { AdminsAdminService } from './admins.admin.service.js';
import {
  type Confirmar2faDto,
  type CriarAdminDto,
  type Desativar2faDto,
  type StatusAdminDto,
  confirmar2faSchema,
  criarAdminSchema,
  desativar2faSchema,
  statusAdminSchema,
} from './dto/admins.dto.js';
import { idSchema } from './dto/contas.dto.js';
import { SegurancaAdminService } from './seguranca.admin.service.js';

const motivoSchema = z.object({ motivo: z.string().trim().min(3).max(300) });

/** 2FA do próprio admin. Liberado sem 2FA (é aqui que ele liga). */
@Controller('admin/2fa')
@SoAdmin()
@Sem2FA()
export class SegurancaAdminController {
  constructor(private readonly seguranca: SegurancaAdminService) {}

  @Get()
  estado(@ContaAtual() admin: Conta) {
    return this.seguranca.estado(admin);
  }

  @Post('iniciar')
  @HttpCode(200)
  iniciar(@ContaAtual() admin: Conta) {
    return this.seguranca.iniciar(admin);
  }

  @Post('confirmar')
  @HttpCode(200)
  confirmar(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(confirmar2faSchema)) dto: Confirmar2faDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.seguranca.confirmar(admin, dto.codigo, ctx);
  }

  @Post('codigos')
  @HttpCode(200)
  novosCodigos(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(confirmar2faSchema)) dto: Confirmar2faDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.seguranca.novosCodigos(admin, dto.codigo, ctx);
  }

  @Delete()
  @HttpCode(204)
  async desativar(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(desativar2faSchema)) dto: Desativar2faDto,
    @Ctx() ctx: Contexto,
  ) {
    await this.seguranca.desativar(admin, dto.senha, dto.codigo, ctx);
  }
}

/** Outros administradores. */
@Controller('admin/admins')
@SoAdmin()
export class AdminsAdminController {
  constructor(private readonly admins: AdminsAdminService) {}

  @Get()
  listar() {
    return this.admins.listar();
  }

  @Post()
  criar(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(criarAdminSchema)) dto: CriarAdminDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.admins.criar(admin, dto, ctx);
  }

  @Patch(':id/status')
  alterarStatus(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(statusAdminSchema)) dto: StatusAdminDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.admins.alterarStatus(admin, id, dto, ctx);
  }

  @Delete(':id/2fa')
  @HttpCode(204)
  async zerar2fa(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(motivoSchema)) dto: { motivo: string },
    @Ctx() ctx: Contexto,
  ) {
    await this.admins.zerar2fa(admin, id, dto.motivo, ctx);
  }
}
