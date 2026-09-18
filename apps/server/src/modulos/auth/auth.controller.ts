import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.js';
import { AuthService, type Contexto, type SessaoEmitida } from './auth.service.js';
import { Ctx } from './decorators/contexto.decorator.js';
import { type CadastroDto, cadastroSchema } from './dto/cadastro.dto.js';
import { type DispositivoDto, dispositivoSchema } from './dto/dispositivo.dto.js';
import { type LoginDto, loginSchema } from './dto/login.dto.js';
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

/** Nome do cookie do refresh token. Só viaja pra `/api/auth`. */
export const COOKIE_REFRESH = 'fr_sessao';

/** 5 tentativas a cada 15 min por IP (o service limita por e-mail). */
const SENSIVEL = { default: { limit: 5, ttl: 15 * 60 * 1000 } };

/**
 * Endpoints públicos de identidade — docs/fluxos/ambiente-fotografo.md §3.
 * Web recebe { acesso, conta } + cookie httpOnly com o refresh.
 * Desktop recebe { tokenApi, conta, dispositivo } e nunca vê cookie.
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
    return this.responderSessao(res, await this.auth.login(dto, ctx));
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Ctx() ctx: Contexto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return this.responderSessao(res, await this.auth.renovar(this.lerRefresh(req), ctx));
    } catch (erro) {
      this.limparCookie(res);
      throw erro;
    }
  }

  @Post('sair')
  @HttpCode(204)
  async sair(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.sair(this.lerRefresh(req));
    this.limparCookie(res);
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

  // ---------------------------------------------------------------------------

  private responderSessao(res: Response, sessao: SessaoEmitida) {
    res.cookie(COOKIE_REFRESH, sessao.refresh, {
      httpOnly: true,
      secure: this.cookieSeguro,
      sameSite: 'lax',
      path: '/api/auth',
      expires: sessao.refreshExpiraEm,
    });
    return { acesso: sessao.acesso, conta: sessao.conta };
  }

  private limparCookie(res: Response) {
    res.clearCookie(COOKIE_REFRESH, { path: '/api/auth' });
  }

  private lerRefresh(req: Request): string | undefined {
    const valor = (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];
    return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
  }
}
