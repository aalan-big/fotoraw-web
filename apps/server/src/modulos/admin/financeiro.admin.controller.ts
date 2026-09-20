import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { SoAdmin } from './admin.guards.js';
import { idSchema } from './dto/contas.dto.js';
import {
  type FalhaRepasseDto,
  type GerarRepasseDto,
  type ListarRepassesDto,
  type PagarRepasseDto,
  type PeriodoDto,
  falhaRepasseSchema,
  gerarRepasseSchema,
  listarRepassesSchema,
  pagarRepasseSchema,
  periodoSchema,
} from './dto/financeiro.dto.js';
import { FinanceiroAdminService } from './financeiro.admin.service.js';

/** Vendas, comissão e a fila de repasses Pix. */
@Controller('admin')
@SoAdmin()
export class FinanceiroAdminController {
  constructor(private readonly financeiro: FinanceiroAdminService) {}

  @Get('financeiro/resumo')
  resumo(@Query(new ZodValidationPipe(periodoSchema)) periodo: PeriodoDto) {
    return this.financeiro.resumo(periodo);
  }

  @Get('financeiro/saldos')
  saldos() {
    return this.financeiro.saldos();
  }

  @Get('repasses')
  listar(@Query(new ZodValidationPipe(listarRepassesSchema)) filtro: ListarRepassesDto) {
    return this.financeiro.listarRepasses(filtro);
  }

  @Post('repasses')
  gerar(
    @ContaAtual() admin: Conta,
    @Body(new ZodValidationPipe(gerarRepasseSchema)) dto: GerarRepasseDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.financeiro.gerarRepasse(admin, dto, ctx);
  }

  @Patch('repasses/:id/pagar')
  pagar(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(pagarRepasseSchema)) dto: PagarRepasseDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.financeiro.pagarRepasse(admin, id, dto, ctx);
  }

  @Patch('repasses/:id/falhou')
  falhou(
    @ContaAtual() admin: Conta,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(falhaRepasseSchema)) dto: FalhaRepasseDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.financeiro.falhaRepasse(admin, id, dto, ctx);
  }
}
