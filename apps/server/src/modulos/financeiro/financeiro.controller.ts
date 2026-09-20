import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import {
  type AtualizarTaxasDto,
  atualizarTaxasSchema,
  type CallbackMercadoPagoDto,
  callbackMercadoPagoSchema,
} from './dto/financeiro.dto.js';
import { FinanceiroService } from './financeiro.service.js';

@Controller('financeiro')
@UseGuards(JwtGuard)
export class FinanceiroController {
  constructor(private readonly financeiro: FinanceiroService) {}

  @Get('saldo')
  async obterSaldo(@ContaAtual() conta: Conta) {
    return this.financeiro.obterSaldo(conta.id);
  }

  @Get('repasses')
  async listarRepasses(@ContaAtual() conta: Conta) {
    return this.financeiro.listarRepasses(conta.id);
  }

  @Get('mercado-pago/conectar')
  obterUrlConectarMercadoPago(@ContaAtual() conta: Conta) {
    return this.financeiro.gerarUrlConectarMercadoPago(conta.id);
  }

  @Post('mercado-pago/callback')
  async callbackMercadoPago(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(callbackMercadoPagoSchema)) dto: CallbackMercadoPagoDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.financeiro.processarCallbackMercadoPago(
      conta.id,
      dto.code,
      dto.state,
      ctx.ip ?? undefined,
    );
  }

  @Delete('mercado-pago')
  async desconectarMercadoPago(
    @ContaAtual() conta: Conta,
    @Ctx() ctx: Contexto,
  ) {
    return this.financeiro.desconectarMercadoPago(conta.id, ctx.ip ?? undefined);
  }

  @Patch('taxas')
  async atualizarTaxas(
    @ContaAtual() conta: Conta,
    @Body(new ZodValidationPipe(atualizarTaxasSchema)) dto: AtualizarTaxasDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.financeiro.atualizarTaxas(conta.id, dto, ctx.ip ?? undefined);
  }
}
