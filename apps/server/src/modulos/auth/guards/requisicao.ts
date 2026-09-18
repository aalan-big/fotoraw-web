import type { Request } from 'express';
import type { Conta, TokenApi } from '../../../infra/prisma/gerado/client.js';

/** O que os guards penduram no request. */
export interface RequisicaoAutenticada extends Request {
  conta: Conta;
  /** presente só quando entrou pelo TokenApiGuard (desktop) */
  tokenApi?: TokenApi;
}

export function extrairBearer(req: Request): string | undefined {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) return undefined;
  const token = cabecalho.slice(7).trim();
  return token.length > 0 ? token : undefined;
}
