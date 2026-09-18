import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../auth.service.js';
import { ContaBloqueadaExcecao, NaoAutenticadoExcecao } from '../auth.excecoes.js';
import { ContasAuthRepositorio } from '../repositorios/contas.repositorio.js';
import { extrairBearer, type RequisicaoAutenticada } from './requisicao.js';

/**
 * Web (fotógrafo e admin): `Authorization: Bearer <jwt de acesso>`.
 * Busca a conta a cada request — token de 15 min não justifica cache, e assim
 * bloqueio/exclusão valem na hora.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly contas: ContasAuthRepositorio,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = extrairBearer(req);
    if (!token) throw new NaoAutenticadoExcecao();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new NaoAutenticadoExcecao();
    }

    const conta = await this.contas.porId(payload.sub);
    if (!conta) throw new NaoAutenticadoExcecao();
    if (conta.status === 'BLOQUEADA') throw new ContaBloqueadaExcecao();

    req.conta = conta;
    return true;
  }
}
