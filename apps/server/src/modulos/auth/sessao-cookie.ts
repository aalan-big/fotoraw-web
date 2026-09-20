import type { Request, Response } from 'express';
import type { SessaoEmitida } from './auth.service.js';

/**
 * Cada painel web tem o seu cookie de refresh, preso ao caminho das suas rotas:
 * o navegador só manda `fr_sessao` pra `/api/auth/*` e `fr_admin` pra
 * `/api/auth/admin/*`. Assim painel e admin abertos no mesmo navegador não
 * disputam a mesma sessão, e uma nunca "vaza" pro outro.
 *
 * O cookie do admin não tem `expires`: some quando o navegador fecha.
 */
export type PublicoWeb = 'fotografo' | 'admin';

export const COOKIE_REFRESH = 'fr_sessao';
export const COOKIE_REFRESH_ADMIN = 'fr_admin';

const COOKIES: Record<PublicoWeb, { nome: string; caminho: string; persistente: boolean }> = {
  fotografo: { nome: COOKIE_REFRESH, caminho: '/api/auth', persistente: true },
  admin: { nome: COOKIE_REFRESH_ADMIN, caminho: '/api/auth/admin', persistente: false },
};

/** Grava o refresh no cookie httpOnly e devolve o corpo `{ acesso, conta }`. */
export function responderSessao(
  res: Response,
  sessao: SessaoEmitida,
  seguro: boolean,
  publico: PublicoWeb = 'fotografo',
) {
  const cookie = COOKIES[publico];
  res.cookie(cookie.nome, sessao.refresh, {
    httpOnly: true,
    secure: seguro,
    sameSite: 'lax',
    path: cookie.caminho,
    ...(cookie.persistente ? { expires: sessao.refreshExpiraEm } : {}),
  });
  return { acesso: sessao.acesso, conta: sessao.conta };
}

export function limparCookieSessao(res: Response, publico: PublicoWeb = 'fotografo') {
  const cookie = COOKIES[publico];
  res.clearCookie(cookie.nome, { path: cookie.caminho });
}

export function lerRefresh(req: Request, publico: PublicoWeb = 'fotografo'): string | undefined {
  const valor = (req.cookies as Record<string, string> | undefined)?.[COOKIES[publico].nome];
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}
