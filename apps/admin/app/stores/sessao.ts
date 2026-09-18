import { defineStore } from 'pinia';
import type { Conta, Sessao } from '~/types/api';

/**
 * Sessão do admin: mesmo esquema do painel (JWT em memória + refresh em cookie
 * httpOnly). A diferença é que só conta com `papel = ADMIN` fica logada aqui.
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

  /** Devolve false se a conta não é admin (a sessão é encerrada). */
  async function entrar(email: string, senha: string): Promise<boolean> {
    const sessao = await bruto()<Sessao>('/auth/login', { method: 'POST', body: { email, senha } });
    if (sessao.conta.papel !== 'ADMIN') {
      await bruto()('/auth/sair', { method: 'POST' }).catch(() => null);
      return false;
    }
    aplicar(sessao);
    return true;
  }

  async function renovar(): Promise<boolean> {
    try {
      const sessao = await bruto()<Sessao>('/auth/refresh', { method: 'POST' });
      if (sessao.conta.papel !== 'ADMIN') {
        limpar();
        return false;
      }
      aplicar(sessao);
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
      await bruto()('/auth/sair', { method: 'POST' });
    } finally {
      limpar();
      await navigateTo('/entrar');
    }
  }

  return { acesso, conta, iniciando, logado, aplicar, limpar, entrar, renovar, sair };
});
