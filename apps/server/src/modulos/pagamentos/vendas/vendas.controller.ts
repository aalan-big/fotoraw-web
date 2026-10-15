import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  /**
   * Link direto (sem JavaScript): conta a baixada e redireciona pro arquivo.
   * `?modo=ver` abre a foto na tela (no iPhone: tocar e segurar → Salvar na Fotos);
   * sem modo, baixa como arquivo.
   */
  @Get('downloads/:token/arquivo')
  async arquivo(
    @Param('token') token: string,
    @Query('modo') modo: string | undefined,
    @Res() res: Response,
  ) {
    const { url } = await this.vendas.baixar(token, modo === 'ver' ? 'ver' : 'baixar');
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  }
}
