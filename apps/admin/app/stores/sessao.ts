import { defineStore } from 'pinia';
import type { Conta, Desafio2fa, Sessao } from '~/types/api';

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

  /**
   * Conta que não é admin recebe 403 PAINEL_ERRADO do server. Com 2FA ligado,
   * devolve o desafio em vez de logar — a tela pede o código e chama `confirmar2fa`.
   */
  async function entrar(email: string, senha: string): Promise<Desafio2fa | null> {
    const r = await bruto()<Sessao | Desafio2fa>('/auth/admin/login', {
      method: 'POST',
      body: { email, senha },
    });
    if ('precisa2fa' in r) return r;
    aplicar(r);
    return null;
  }

  async function confirmar2fa(desafio: string, codigo: string) {
    aplicar(
      await bruto()<Sessao>('/auth/admin/login/2fa', { method: 'POST', body: { desafio, codigo } }),
    );
  }

  /** depois de ligar/desligar o 2FA, o chip do cabeçalho precisa saber */
  function marcarTotp(ativo: boolean) {
    if (conta.value) conta.value = { ...conta.value, totpAtivo: ativo };
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

  return {
    acesso,
    conta,
    iniciando,
    logado,
    aplicar,
    limpar,
    entrar,
    confirmar2fa,
    marcarTotp,
    renovar,
    sair,
  };
});
