import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack';

/**
 * `$fetch` apontado pro server, com o Bearer da sessão. Num 401, tenta renovar
 * pelo cookie **uma vez** e repete; se não der, derruba a sessão e manda pro login.
 *
 *   const api = useApi();
 *   const eu = await api<Eu>('/me');
 */
export function useApi() {
  const { apiBase } = useRuntimeConfig().public;
  const sessao = useSessao();

  const chamar = <T>(caminho: string, opcoes: NitroFetchOptions<NitroFetchRequest> = {}) =>
    $fetch<T>(caminho, {
      baseURL: apiBase,
      credentials: 'include',
      ...opcoes,
      headers: {
        ...(opcoes.headers as Record<string, string> | undefined),
        ...(sessao.acesso ? { Authorization: `Bearer ${sessao.acesso}` } : {}),
      },
    });

  return async <T>(
    caminho: string,
    opcoes: NitroFetchOptions<NitroFetchRequest> = {},
  ): Promise<T> => {
    try {
      return await chamar<T>(caminho, opcoes);
    } catch (erro) {
      const status = (erro as { status?: number })?.status;
      const codigo = (erro as { data?: { codigo?: string } })?.data?.codigo;
      // ADMIN_EXIGE_2FA: sem 2FA só a tela de segurança funciona
      if (status === 403 && codigo === 'SEM_2FA') {
        await navigateTo('/seguranca?obrigatorio=1');
        throw erro;
      }
      const rotaDeAuth = caminho.startsWith('/auth/');
      if (status !== 401 || rotaDeAuth) throw erro;
      if (await sessao.renovar()) return chamar<T>(caminho, opcoes);
      await navigateTo('/entrar');
      throw erro;
    }
  };
}
