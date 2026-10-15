import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Contexto } from '../auth/auth.service.js';
import { Ctx } from '../auth/decorators/contexto.decorator.js';
import {
  type AbrirGaleriaDto,
  type AcessoPorCodigoDto,
  abrirGaleriaSchema,
  acessoPorCodigoSchema,
} from './dto/abrir-galeria.dto.js';
import { type ListarGaleriasDto, listarGaleriasSchema } from './dto/listar-galerias.dto.js';
import { PublicoService } from './publico.service.js';

/** Rotas sem autenticação consumidas pela vitrine (Nuxt). */
@Controller('publico')
export class PublicoController {
  constructor(private readonly publico: PublicoService) {}

  @Get('galerias')
  listarGalerias(@Query(new ZodValidationPipe(listarGaleriasSchema)) dto: ListarGaleriasDto) {
    return this.publico.listarGalerias(dto);
  }

  @Get('fotografos/:slug')
  perfilFotografo(@Param('slug') slug: string) {
    return this.publico.perfilFotografo(slug);
  }

  /** fotoraw.com.br/@conta/galeria — a senha (raro) vai no header, nunca na URL */
  @Get('galerias/:conta/:galeria')
  abrirGaleria(
    @Param('conta') conta: string,
    @Param('galeria') galeria: string,
    @Query(new ZodValidationPipe(abrirGaleriaSchema)) dto: AbrirGaleriaDto,
    @Headers('x-senha-galeria') senha: string | undefined,
    @Ctx() ctx: Contexto,
  ) {
    return this.publico.abrirGaleria(conta, galeria, dto, ctx.ip ?? 'sem-ip', senha);
  }

  @Post('acesso')
  @HttpCode(200)
  acessoPorCodigo(
    @Body(new ZodValidationPipe(acessoPorCodigoSchema)) dto: AcessoPorCodigoDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.publico.acessoPorCodigo(dto, ctx.ip ?? 'sem-ip');
  }
}
