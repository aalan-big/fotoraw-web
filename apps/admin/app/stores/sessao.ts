import { defineStore } from 'pinia';
import type { Conta, Sessao } from '~/types/api';

/**
 * Sessão do admin: mesmo esquema do painel (JWT em memória + refresh em cookie
 * httpOnly), mas nas rotas `/auth/admin/*`: cookie próprio (`fr_admin`, some ao
 * fechar o navegador), papel ADMIN exigido pelo server, sessão de horas.
 */
export const useSessao = defineStore('sessao', () => {
  const acesso = ref<string | null>(null);
  const conta = ref<Conta | null>(null);
  const iniciando = ref(true);

  const logado = computed(() => acesso.value !== null && conta.value !== null);

  function aplicar(sessao: Sessao) {
    acesso.value = sessao.acesso;
    conta.value = sessao.conta;
  }
  function limpar() {
    acesso.value = null;
    conta.value = null;
  }
  function bruto() {
    const { apiBase } = useRuntimeConfig().public;
    return <T>(caminho: string, opcoes: Parameters<typeof $fetch>[1] = {}) =>
      $fetch<T>(caminho, { baseURL: apiBase, credentials: 'include', ...opcoes });
  }

  /** Conta que não é admin recebe 403 PAINEL_ERRADO do server. */
  async function entrar(email: string, senha: string) {
    aplicar(await bruto()<Sessao>('/auth/admin/login', { method: 'POST', body: { email, senha } }));
  }

  async function renovar(): Promise<boolean> {
    try {
      aplicar(await bruto()<Sessao>('/auth/admin/refresh', { method: 'POST' }));
      return true;
    } catch {
      limpar();
      return false;
    } finally {
      iniciando.value = false;
    }
  }

  async function sair() {
    try {
      await bruto()('/auth/admin/sair', { method: 'POST' });
    } finally {
      limpar();
      await navigateTo('/entrar');
    }
  }

  return { acesso, conta, iniciando, logado, aplicar, limpar, entrar, renovar, sair };
});
