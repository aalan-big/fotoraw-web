import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import { z } from 'zod';
import { VendasService } from '../pagamentos/vendas/vendas.service.js';
import { FinanceiroAdminService } from './financeiro.admin.service.js';

const numeroSchema = z.coerce.number().int().positive();
const devolverSchema = z.object({ motivo: z.string().trim().min(3, { message: 'Diga o motivo' }).max(300) });

/** Vendas, comissão e a fila de repasses Pix. */
@Controller('admin')
@SoAdmin()
export class FinanceiroAdminController {
  constructor(
    private readonly financeiro: FinanceiroAdminService,
    private readonly vendas: VendasService,
  ) {}

  @Get('pedidos/:numero')
  pedido(@Param('numero', new ZodValidationPipe(numeroSchema)) numero: number) {
    return this.financeiro.pedidoPorNumero(numero);
  }

  /** Devolução feita pelo admin (motivo obrigatório, vai pra auditoria). */
  @Post('pedidos/:numero/devolver')
  @HttpCode(200)
  async devolver(
    @ContaAtual() admin: Conta,
    @Param('numero', new ZodValidationPipe(numeroSchema)) numero: number,
    @Body(new ZodValidationPipe(devolverSchema)) dto: z.infer<typeof devolverSchema>,
    @Ctx() ctx: Contexto,
  ) {
    const pedido = await this.financeiro.pedidoPorNumero(numero);
    return this.vendas.devolver(pedido.id, { contaId: admin.id, papel: 'ADMIN' }, dto.motivo, ctx.ip ?? undefined);
  }

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
