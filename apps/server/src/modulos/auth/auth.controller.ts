import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { AuthService, type Contexto, type SessaoEmitida } from './auth.service.js';
import { Ctx } from './decorators/contexto.decorator.js';
import {
  lerRefresh,
  limparCookieSessao,
  type PublicoWeb,
  responderSessao,
} from './sessao-cookie.js';
import { type CadastroDto, cadastroSchema } from './dto/cadastro.dto.js';
import { type DispositivoDto, dispositivoSchema } from './dto/dispositivo.dto.js';
import { PainelErradoExcecao } from './auth.excecoes.js';
import { type Login2faDto, type LoginDto, login2faSchema, loginSchema } from './dto/login.dto.js';
import {
  type RecuperarSenhaDto,
  type RedefinirSenhaDto,
  recuperarSenhaSchema,
  redefinirSenhaSchema,
} from './dto/senha.dto.js';
import {
  type ReenviarVerificacaoDto,
  type VerificarEmailDto,
  reenviarVerificacaoSchema,
  verificarEmailSchema,
} from './dto/verificar-email.dto.js';

/**
 * Limite por IP nas rotas de credencial (o service limita por e-mail).
 * Produção: 5 a cada 15 min. Dev: 30 — painel, desktop e curl batem do mesmo IP.
 */
const SENSIVEL = {
  default: { limit: process.env.NODE_ENV === 'production' ? 5 : 30, ttl: 15 * 60 * 1000 },
};

/**
 * Endpoints públicos de identidade — docs/fluxos/ambiente-fotografo.md §3.
 * Web recebe { acesso, conta } + cookie httpOnly com o refresh.
 * Desktop recebe { tokenApi, conta, dispositivo } e nunca vê cookie.
 *
 * O admin tem login/refresh/sair próprios em `/auth/admin/*`: cookie separado
 * (`fr_admin`, preso a esse caminho), papel ADMIN exigido aqui, sessão curta.
 */
@Controller('auth')
export class AuthController {
  private readonly cookieSeguro: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSeguro = config.get('NODE_ENV') === 'production';
  }

  @Post('cadastro')
  @Throttle(SENSIVEL)
  async cadastro(
    @Body(new ZodValidationPipe(cadastroSchema)) dto: CadastroDto,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderSessao(res, await this.auth.cadastrar(dto, ctx));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(SENSIVEL)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(dto, ctx, 'fotografo');
    if ('precisa2fa' in r) throw new PainelErradoExcecao(); // fotógrafo não tem 2FA (ainda)
    return this.responderSessao(res, r);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Ctx() ctx: Contexto, @Res({ passthrough: true }) res: Response) {
    return this.renovar(req, ctx, res, 'fotografo');
  }

  @Post('sair')
  @HttpCode(204)
  sair(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.encerrar(req, res, 'fotografo');
  }

  // ---- admin ---------------------------------------------------------------

  @Post('admin/login')
  @HttpCode(200)
  @Throttle(SENSIVEL)
  async loginAdmin(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(dto, ctx, 'admin');
    // 2FA ligado: nada de cookie ainda — o cliente volta com o código
    if ('precisa2fa' in r) return r;
    return this.responderSessao(res, r, 'admin');
  }

  /** Segunda etapa do login do admin (código do app ou de recuperação). */
  @Post('admin/login/2fa')
  @HttpCode(200)
  @Throttle(SENSIVEL)
  async login2fa(
    @Body(new ZodValidationPipe(login2faSchema)) dto: Login2faDto,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderSessao(
      res,
      await this.auth.confirmar2fa(dto.desafio, dto.codigo, ctx),
      'admin',
    );
  }

  @Post('admin/refresh')
  @HttpCode(200)
  refreshAdmin(
    @Req() req: Request,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.renovar(req, ctx, res, 'admin');
  }

  @Post('admin/sair')
  @HttpCode(204)
  sairAdmin(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.encerrar(req, res, 'admin');
  }

  /** Desktop: e-mail + senha uma vez → token_api. */
  @Post('dispositivo')
  @HttpCode(200)
  @Throttle(SENSIVEL)
  dispositivo(
    @Body(new ZodValidationPipe(dispositivoSchema)) dto: DispositivoDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.auth.vincularDispositivo(dto, ctx);
  }

  @Post('verificar-email')
  @HttpCode(200)
  verificarEmail(
    @Body(new ZodValidationPipe(verificarEmailSchema)) dto: VerificarEmailDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.auth.verificarEmail(dto.token, ctx);
  }

  @Post('reenviar-verificacao')
  @HttpCode(204)
  @Throttle(SENSIVEL)
  async reenviarVerificacao(
    @Body(new ZodValidationPipe(reenviarVerificacaoSchema)) dto: ReenviarVerificacaoDto,
  ) {
    await this.auth.reenviarVerificacao(dto.email);
  }

  @Post('confirmar-email')
  @HttpCode(200)
  confirmarEmail(
    @Body(new ZodValidationPipe(verificarEmailSchema)) dto: VerificarEmailDto,
    @Ctx() ctx: Contexto,
  ) {
    return this.auth.confirmarTrocaEmail(dto.token, ctx);
  }

  @Post('recuperar-senha')
  @HttpCode(204)
  @Throttle(SENSIVEL)
  async recuperarSenha(@Body(new ZodValidationPipe(recuperarSenhaSchema)) dto: RecuperarSenhaDto) {
    await this.auth.recuperarSenha(dto.email);
  }

  @Post('redefinir-senha')
  @HttpCode(204)
  @Throttle(SENSIVEL)
  async redefinirSenha(
    @Body(new ZodValidationPipe(redefinirSenhaSchema)) dto: RedefinirSenhaDto,
    @Ctx() ctx: Contexto,
  ) {
    await this.auth.redefinirSenha(dto.token, dto.senha, ctx);
  }

  private async renovar(req: Request, ctx: Contexto, res: Response, publico: PublicoWeb) {
    try {
      const sessao = await this.auth.renovar(lerRefresh(req, publico), ctx, publico);
      return this.responderSessao(res, sessao, publico);
    } catch (erro) {
      limparCookieSessao(res, publico);
      throw erro;
    }
  }

  private async encerrar(req: Request, res: Response, publico: PublicoWeb) {
    await this.auth.sair(lerRefresh(req, publico));
    limparCookieSessao(res, publico);
  }

  private responderSessao(res: Response, sessao: SessaoEmitida, publico: PublicoWeb = 'fotografo') {
    return responderSessao(res, sessao, this.cookieSeguro, publico);
  }
}
