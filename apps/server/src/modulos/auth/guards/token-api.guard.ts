import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.js';
import { ContaBloqueadaExcecao, NaoAutenticadoExcecao } from '../auth.excecoes.js';
import { ContasAuthRepositorio } from '../repositorios/contas.repositorio.js';
import { DispositivosRepositorio } from '../repositorios/dispositivos.repositorio.js';
import { DIA_MS, daquiA, hashToken } from '../tokens.js';
import { extrairBearer, type RequisicaoAutenticada } from './requisicao.js';

/**
 * Desktop: `Authorization: Bearer <token_api>` (opaco; só o hash está no banco).
 * Renova sozinho: se passou da metade da validade, empurra `expira_em` de novo.
 */
@Injectable()
export class TokenApiGuard implements CanActivate {
  private readonly validadeMs: number;

  constructor(
    private readonly dispositivos: DispositivosRepositorio,
    private readonly contas: ContasAuthRepositorio,
    config: ConfigService<Env, true>,
  ) {
    this.validadeMs = config.get('TOKEN_API_DIAS') * DIA_MS;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = extrairBearer(req);
    if (!token) throw new NaoAutenticadoExcecao();

    const registro = await this.dispositivos.tokenPorHash(hashToken(token));
    const agora = Date.now();
    if (
      !registro ||
      registro.revogadoEm ||
      (registro.expiraEm && registro.expiraEm.getTime() < agora)
    ) {
      throw new NaoAutenticadoExcecao();
    }

    const conta = await this.contas.porId(registro.contaId);
    if (!conta) throw new NaoAutenticadoExcecao();
    if (conta.status === 'BLOQUEADA') throw new ContaBloqueadaExcecao();

    const naMetadeFinal =
      registro.expiraEm !== null && registro.expiraEm.getTime() - agora < this.validadeMs / 2;
    await this.dispositivos.registrarUso(
      registro.id,
      naMetadeFinal ? daquiA(this.validadeMs) : undefined,
    );

    req.conta = conta;
    req.tokenApi = registro;
    return true;
  }
}
