import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import {
  type AssinarPlanoDto,
  type CancelarAssinaturaDto,
  assinarPlanoSchema,
  cancelarAssinaturaSchema,
} from './dto/planos.dto.js';
import { PlanosService } from './planos.service.js';

@Controller('planos')
@UseGuards(JwtGuard)
export class PlanosController {
  constructor(private readonly planos: PlanosService) {}

  @Get()
  listar() {
    return this.planos.listarPlanos();
  }

  @Get('meu-status')
  meuStatus(@ContaAtual() conta: Conta) {
    return this.planos.obterStatus(conta.id);
  }

  @Post('assinar')
  @HttpCode(200)
  assinar(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(assinarPlanoSchema)) dto: AssinarPlanoDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.planos.assinar(conta, dto, ctx);
  }

  @Post('cancelar')
  @HttpCode(200)
  cancelar(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(cancelarAssinaturaSchema)) dto: CancelarAssinaturaDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.planos.cancelar(conta, dto, ctx);
  }

  @Post('reativar')
  @HttpCode(200)
  reativar(@ContaAtual() conta: Conta, @Ctx() ctx: Contexto) {
    return this.planos.reativar(conta, ctx);
  }
}
