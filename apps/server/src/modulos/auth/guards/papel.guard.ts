import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PapelConta } from '../../../infra/prisma/gerado/client.js';
import { NaoAutenticadoExcecao, SemPermissaoExcecao } from '../auth.excecoes.js';
import { PAPEIS_CHAVE } from '../decorators/papel.decorator.js';
import type { RequisicaoAutenticada } from './requisicao.js';

/** Usar depois do JwtGuard: `@UseGuards(JwtGuard, PapelGuard) @Papel('ADMIN')`. */
@Injectable()
export class PapelGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const papeis = this.reflector.getAllAndOverride<PapelConta[] | undefined>(PAPEIS_CHAVE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!papeis || papeis.length === 0) return true;

    const { conta } = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    if (!conta) throw new NaoAutenticadoExcecao();
    if (!papeis.includes(conta.papel)) throw new SemPermissaoExcecao();
    return true;
  }
}
