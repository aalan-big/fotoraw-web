import type { ErroApi } from '~/types/api';

/** Tira a mensagem e os erros de campo de um erro do `$fetch`. */
export function lerErroApi(erro: unknown): ErroApi {
  const data = (erro as { data?: Partial<ErroApi> })?.data;
  if (data?.codigo) return data as ErroApi;
  return {
    status: 0,
    codigo: 'SEM_CONEXAO',
    mensagem: 'Não deu pra falar com o servidor. Tente de novo.',
  };
}

/** `{ senha: 'mínimo 8', slug: '...' }` a partir de `erros[]`. */
export function errosPorCampo(erro: ErroApi): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const e of erro.erros ?? []) if (!mapa[e.campo]) mapa[e.campo] = e.mensagem;
  return mapa;
}
