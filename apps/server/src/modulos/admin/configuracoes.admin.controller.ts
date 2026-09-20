import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { SoAdmin } from './admin.guards.js';
import { ConfiguracoesAdminService } from './configuracoes.admin.service.js';

const chaveSchema = z.string().regex(/^[a-z_]{3,60}$/);
/** o tipo de verdade é validado pelo catálogo, por chave */
const valorSchema = z.object({ valor: z.union([z.number(), z.string()]) });

/** `configuracoes_plataforma` — os ajustes que mudam sem deploy. */
@Controller('admin/configuracoes')
@SoAdmin()
export class ConfiguracoesAdminController {
  constructor(private readonly configuracoes: ConfiguracoesAdminService) {}

  @Get()
  listar() {
    return this.configuracoes.listar();
  }

  @Put(':chave')
  alterar(
    @ContaAtual() admin: Conta,
    @Param('chave', new ZodValidationPipe(chaveSchema)) chave: string,
    @Body(new ZodValidationPipe(valorSchema)) body: { valor: number | string },
    @Ctx() ctx: Contexto,
  ) {
    return this.configuracoes.alterar(admin, chave, body.valor, ctx);
  }
}
