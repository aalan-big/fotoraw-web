import { defineStore } from 'pinia';
import type { Conta, Eu, Sessao } from '~/types/api';

/**
 * Sessão da web: o JWT de acesso fica só em memória (some no F5); o refresh vive
 * num cookie httpOnly que o server gerencia. Ao abrir o app, `renovar()` tenta
 * recuperar a sessão pelo cookie (plugins/sessao.client.ts).
 */
export const useSessao = defineStore('sessao', () => {
  const acesso = ref<string | null>(null);
  const conta = ref<Conta | null>(null);
  const eu = ref<Eu | null>(null);
  /** true até a primeira tentativa de renovar terminar */
  const iniciando = ref(true);

  const logado = computed(() => acesso.value !== null && conta.value !== null);

  function aplicar(sessao: Sessao) {
    acesso.value = sessao.acesso;
    conta.value = sessao.conta;
  }

  function limpar() {
    acesso.value = null;
    conta.value = null;
    eu.value = null;
  }

  function bruto() {
    const { apiBase } = useRuntimeConfig().public;
    return <T>(caminho: string, opcoes: Parameters<typeof $fetch>[1] = {}) =>
      $fetch<T>(caminho, { baseURL: apiBase, credentials: 'include', ...opcoes });
  }

  async function entrar(email: string, senha: string) {
    aplicar(await bruto()<Sessao>('/auth/login', { method: 'POST', body: { email, senha } }));
  }

  async function cadastrar(dados: { nome: string; email: string; senha: string; slug: string }) {
    aplicar(await bruto()<Sessao>('/auth/cadastro', { method: 'POST', body: dados }));
  }

  /** Usa o cookie. Devolve false se não tinha sessão pra recuperar. */
  async function renovar(): Promise<boolean> {
    try {
      aplicar(await bruto()<Sessao>('/auth/refresh', { method: 'POST' }));
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

  /** `GET /me` — conta + perfil + licença + pendências. */
  async function carregarEu(): Promise<Eu> {
    const api = useApi();
    eu.value = await api<Eu>('/me');
    conta.value = eu.value.conta;
    return eu.value;
  }

  return {
    acesso,
    conta,
    eu,
    iniciando,
    logado,
    aplicar,
    limpar,
    entrar,
    cadastrar,
    renovar,
    sair,
    carregarEu,
  };
});
