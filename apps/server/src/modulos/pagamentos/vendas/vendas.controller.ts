import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../comum/pipes/zod-validation.pipe.js';
import {
  type CriarPedidoDto,
  criarPedidoSchema,
  type PagarCartaoDto,
  pagarCartaoSchema,
} from './dto/vendas.dto.js';
import { VendasService } from './vendas.service.js';

const uuid = new ZodValidationPipe(z.uuid());
/** criar pedido / gerar cobrança: sem login, então limitado por IP */
const COMPRA = { default: { limit: 20, ttl: 10 * 60 * 1000 } };

/**
 * Compra na vitrine, sem conta: carrinho → pedido → Pix ou cartão → download.
 * O id do pedido (uuid) é o que dá acesso a ele — vai no e-mail do comprador.
 */
@Controller('publico')
export class VendasController {
  constructor(private readonly vendas: VendasService) {}

  @Post('pedidos')
  @Throttle(COMPRA)
  criar(@Body(new ZodValidationPipe(criarPedidoSchema)) dto: CriarPedidoDto) {
    return this.vendas.criarPedido(dto);
  }

  @Get('pedidos/:id')
  consultar(@Param('id', uuid) id: string) {
    return this.vendas.consultar(id);
  }

  @Post('pedidos/:id/pix')
  @Throttle(COMPRA)
  @HttpCode(200)
  pix(@Param('id', uuid) id: string) {
    return this.vendas.pagarPix(id);
  }

  @Post('pedidos/:id/cartao')
  @Throttle(COMPRA)
  @HttpCode(200)
  cartao(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(pagarCartaoSchema)) dto: PagarCartaoDto,
  ) {
    return this.vendas.pagarCartao(id, dto);
  }

  @Get('downloads/:token')
  baixar(@Param('token') token: string) {
    return this.vendas.baixar(token);
  }
}
