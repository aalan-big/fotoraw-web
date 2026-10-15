import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import {
  type ExportarCsvDto,
  exportarCsvSchema,
  type ListarPedidosDto,
  listarPedidosSchema,
} from './dto/pedidos.dto.js';
import type { Contexto } from '../auth/auth.service.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { VendasService } from '../pagamentos/vendas/vendas.service.js';
import { PedidosService } from './pedidos.service.js';

const devolverSchema = z.object({ motivo: z.string().trim().max(300).optional() });

const numeroSchema = z.coerce.number().int().positive();

@Controller('pedidos')
@UseGuards(JwtGuard)
export class PedidosController {
  constructor(
    private readonly pedidos: PedidosService,
    private readonly vendas: VendasService,
  ) {}

  @Get()
  async listar(
    @ContaAtual() conta: Conta,
    @Query(new ZodValidationPipe(listarPedidosSchema)) filtro: ListarPedidosDto,
  ) {
    return this.pedidos.listar(conta.id, filtro);
  }

  @Get('metricas')
  async metricas(@ContaAtual() conta: Conta) {
    return this.pedidos.obterMetricas(conta.id);
  }

  @Get('exportar-csv')
  async exportarCsv(
    @ContaAtual() conta: Conta,
    @Query(new ZodValidationPipe(exportarCsvSchema)) filtro: ExportarCsvDto,
    @Res() res: Response,
  ) {
    const csv = await this.pedidos.gerarCsv(conta.id, filtro);
    const dataHoje = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vendas-fotoraw-${dataHoje}.csv"`,
    );

    return res.send(csv);
  }

  /** Devolver ao comprador: estorno total no Mercado Pago + downloads desativados. */
  @Post(':numero/devolver')
  @HttpCode(200)
  async devolver(
    @ContaAtual() conta: Conta,
    @Param('numero', new ZodValidationPipe(numeroSchema)) numero: number,
    @Body(new ZodValidationPipe(devolverSchema)) dto: z.infer<typeof devolverSchema>,
    @Ctx() ctx: Contexto,
  ) {
    const pedido = await this.pedidos.obterPorNumero(numero, conta.id);
    return this.vendas.devolver(pedido.id, { contaId: conta.id, papel: 'FOTOGRAFO' }, dto.motivo, ctx.ip ?? undefined);
  }

  @Get(':numero')
  async obterPorNumero(
    @ContaAtual() conta: Conta,
    @Param('numero', new ZodValidationPipe(numeroSchema)) numero: number,
  ) {
    return this.pedidos.obterPorNumero(numero, conta.id);
  }
}
