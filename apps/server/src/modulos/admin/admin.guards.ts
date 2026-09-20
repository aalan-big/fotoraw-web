import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Env } from '../../config/env.js';
import { Sem2faExcecao } from '../auth/auth.excecoes.js';
import { Papel } from '../auth/decorators/papel.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { PapelGuard } from '../auth/guards/papel.guard.js';
import type { RequisicaoAutenticada } from '../auth/guards/requisicao.js';

const SEM_2FA_CHAVE = 'sem2fa';

/** Rotas que o admin pode usar ANTES de ativar o 2FA (as do próprio 2FA). */
export const Sem2FA = () => SetMetadata(SEM_2FA_CHAVE, true);

/**
 * Com `ADMIN_EXIGE_2FA` (padrão em produção), admin sem 2FA só acessa as rotas
 * marcadas com `@Sem2FA()` — o app manda ele configurar antes de tudo.
 */
@Injectable()
export class Exige2faGuard implements CanActivate {
  private readonly exige: boolean;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    const valor = config.get('ADMIN_EXIGE_2FA');
    this.exige = valor ? valor === 'true' : config.get('NODE_ENV') === 'production';
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.exige) return true;
    const liberada = this.reflector.getAllAndOverride<boolean | undefined>(SEM_2FA_CHAVE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (liberada) return true;
    const { conta } = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (conta && !conta.totpAtivadoEm) throw new Sem2faExcecao();
    return true;
  }
}

/** Tudo sob /admin/* : sessão web + papel ADMIN (+ 2FA quando exigido). */
export const SoAdmin = () =>
  applyDecorators(UseGuards(JwtGuard, PapelGuard, Exige2faGuard), Papel('ADMIN'));
