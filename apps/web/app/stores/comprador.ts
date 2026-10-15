import { defineStore } from 'pinia';

export interface PerfilComprador {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  cpf: string | null;
}

const CHAVE = 'fotoraw:comprador';

/**
 * Comprador que entrou em "Minhas fotos" (sem senha: código por e-mail).
 * Fica no localStorage — comprar continua possível sem entrar.
 */
export const useComprador = defineStore('comprador', () => {
  const acesso = ref<string | null>(null);
  const perfil = ref<PerfilComprador | null>(null);
  const carregado = ref(false);
  const api = useApi();

  /** Chamar no onMounted (no SSR não existe localStorage). */
  function carregar() {
    if (carregado.value) return;
    carregado.value = true;
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as {
        acesso: string;
        perfil: PerfilComprador;
      } | null;
      if (salvo?.acesso) {
        acesso.value = salvo.acesso;
        perfil.value = salvo.perfil;
      }
    } catch {
      // armazenamento bloqueado: segue como visitante
    }
  }

  function salvar() {
    try {
      if (acesso.value) localStorage.setItem(CHAVE, JSON.stringify({ acesso: acesso.value, perfil: perfil.value }));
      else localStorage.removeItem(CHAVE);
    } catch {
      // modo privado: a sessão vale só nesta aba
    }
  }

  function entrou(dados: { acesso: string; comprador: PerfilComprador }) {
    acesso.value = dados.acesso;
    perfil.value = dados.comprador;
    salvar();
  }

  function sair() {
    acesso.value = null;
    perfil.value = null;
    salvar();
  }

  /** Chamada autenticada; sessão vencida (401) desloga. */
  async function chamar<T>(caminho: string, opcoes: Parameters<typeof api>[1] = {}) {
    try {
      return await api<T>(caminho, {
        ...opcoes,
        headers: { ...(opcoes.headers as Record<string, string> | undefined), Authorization: `Bearer ${acesso.value}` },
      });
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 401) sair();
      throw e;
    }
  }

  async function atualizarPerfil(dados: Partial<Pick<PerfilComprador, 'nome' | 'whatsapp' | 'cpf'>>) {
    perfil.value = await chamar<PerfilComprador>('/compradores/eu', { method: 'PATCH', body: dados });
    salvar();
  }

  const logado = computed(() => !!acesso.value);
  return { acesso, perfil, logado, carregado, carregar, entrou, sair, chamar, atualizarPerfil };
});
