import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import type { Contexto } from '../auth/auth.service.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import { CompradorAtual, CompradorGuard } from './comprador.guard.js';
import { CompradoresService } from './compradores.service.js';
import {
  type AtualizarPerfilDto,
  atualizarPerfilSchema,
  type ConfirmarCodigoDto,
  confirmarCodigoSchema,
  type PedirCodigoDto,
  pedirCodigoSchema,
} from './dto/compradores.dto.js';

/** entrar: sem login, então limitado por IP */
const ENTRAR = { default: { limit: 15, ttl: 15 * 60 * 1000 } };

/** Área "Minhas fotos" do comprador (vitrine). */
@Controller('compradores')
export class CompradoresController {
  constructor(private readonly compradores: CompradoresService) {}

  @Post('entrar/codigo')
  @Throttle(ENTRAR)
  @HttpCode(200)
  pedirCodigo(@Body(new ZodValidationPipe(pedirCodigoSchema)) dto: PedirCodigoDto) {
    return this.compradores.pedirCodigo(dto);
  }

  @Post('entrar/confirmar')
  @Throttle(ENTRAR)
  @HttpCode(200)
  confirmar(@Body(new ZodValidationPipe(confirmarCodigoSchema)) dto: ConfirmarCodigoDto) {
    return this.compradores.confirmarCodigo(dto);
  }

  @Get('eu')
  @UseGuards(CompradorGuard)
  eu(@CompradorAtual() id: string) {
    return this.compradores.eu(id);
  }

  @Patch('eu')
  @UseGuards(CompradorGuard)
  atualizar(
    @CompradorAtual() id: string,
    @Body(new ZodValidationPipe(atualizarPerfilSchema)) dto: AtualizarPerfilDto,
  ) {
    return this.compradores.atualizar(id, dto);
  }

  /** LGPD: apagar meus dados pessoais. */
  @Delete('eu')
  @UseGuards(CompradorGuard)
  apagar(@CompradorAtual() id: string, @Ctx() ctx: Contexto) {
    return this.compradores.apagarMeusDados(id, ctx.ip ?? undefined);
  }

  @Get('eu/fotos')
  @UseGuards(CompradorGuard)
  fotos(@CompradorAtual() id: string) {
    return this.compradores.minhasFotos(id);
  }
}
