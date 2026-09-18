import type { Request, Response } from 'express';
import type { SessaoEmitida } from './auth.service.js';

/** Nome do cookie do refresh token. Só viaja pra `/api/auth`. */
export const COOKIE_REFRESH = 'fr_sessao';
const CAMINHO = '/api/auth';

/** Grava o refresh no cookie httpOnly e devolve o corpo `{ acesso, conta }`. */
export function responderSessao(res: Response, sessao: SessaoEmitida, seguro: boolean) {
  res.cookie(COOKIE_REFRESH, sessao.refresh, {
    httpOnly: true,
    secure: seguro,
    sameSite: 'lax',
    path: CAMINHO,
    expires: sessao.refreshExpiraEm,
  });
  return { acesso: sessao.acesso, conta: sessao.conta };
}

export function limparCookieSessao(res: Response) {
  res.clearCookie(COOKIE_REFRESH, { path: CAMINHO });
}

export function lerRefresh(req: Request): string | undefined {
  const valor = (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}
