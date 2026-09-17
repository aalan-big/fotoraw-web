import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack';

/**
 * `$fetch` já apontado pro server (NestJS). Uso:
 *   const api = useApi();
 *   const galerias = await api<GaleriaPublica[]>('/publico/galerias');
 */
export function useApi() {
  const { apiBase } = useRuntimeConfig().public;
  return <T>(caminho: string, opcoes: NitroFetchOptions<NitroFetchRequest> = {}) =>
    $fetch<T>(caminho, { baseURL: apiBase, ...opcoes });
}
