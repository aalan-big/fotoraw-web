<script setup lang="ts">
import type { Conta, Sessao } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Conta' });

const api = useApi();
const sessao = useSessao();

// --- dados ---------------------------------------------------------------
const dados = reactive({ nome: sessao.conta?.nome ?? '', email: sessao.conta?.email ?? '' });
const salvandoDados = ref(false);
const msgDados = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
const errosDados = ref<Record<string, string>>({});

async function salvarDados() {
  salvandoDados.value = true;
  msgDados.value = null;
  errosDados.value = {};
  try {
    const r = await api<{ conta: Conta; emailPendente: string | null }>('/me', {
      method: 'PATCH',
      body: { nome: dados.nome, email: dados.email },
    });
    sessao.conta = r.conta;
    msgDados.value = {
      tipo: 'sucesso',
      texto: r.emailPendente
        ? `Nome salvo. Mandamos um link pra ${r.emailPendente} — o e-mail só muda depois que você confirmar.`
        : 'Dados salvos.',
    };
    if (r.emailPendente) dados.email = r.conta.email;
    await sessao.carregarEu().catch(() => null);
  } catch (e) {
    const apiErro = lerErroApi(e);
    errosDados.value = errosPorCampo(apiErro);
    if (apiErro.codigo === 'EMAIL_JA_CADASTRADO') errosDados.value.email = apiErro.mensagem;
    else if (!apiErro.erros?.length) msgDados.value = { tipo: 'erro', texto: apiErro.mensagem };
  } finally {
    salvandoDados.value = false;
  }
}

const reenviando = ref(false);
const reenviado = ref(false);
async function reenviarVerificacao() {
  reenviando.value = true;
  try {
    await api('/auth/reenviar-verificacao', {
      method: 'POST',
      body: { email: sessao.conta?.email },
    });
    reenviado.value = true;
  } finally {
    reenviando.value = false;
  }
}

// --- senha ---------------------------------------------------------------
const senha = reactive({ atual: '', nova: '', confirmacao: '' });
const salvandoSenha = ref(false);
const msgSenha = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

async function salvarSenha() {
  if (senha.nova !== senha.confirmacao) {
    msgSenha.value = { tipo: 'erro', texto: 'As senhas novas não são iguais' };
    return;
  }
  salvandoSenha.value = true;
  msgSenha.value = null;
  try {
    // o server derruba as outras sessões e devolve uma nova pra esta aba
    const nova = await api<Sessao>('/me/senha', {
      method: 'PUT',
      body: { senhaAtual: senha.atual, novaSenha: senha.nova },
    });
    sessao.aplicar(nova);
    senha.atual = senha.nova = senha.confirmacao = '';
    msgSenha.value = {
      tipo: 'sucesso',
      texto: 'Senha alterada. Outras abas e o desktop vão pedir login de novo.',
    };
  } catch (e) {
    const apiErro = lerErroApi(e);
    msgSenha.value = {
      tipo: 'erro',
      texto:
        apiErro.codigo === 'CREDENCIAIS_INVALIDAS'
          ? 'A senha atual não confere'
          : (errosPorCampo(apiErro).novaSenha ?? apiErro.mensagem),
    };
  } finally {
    salvandoSenha.value = false;
  }
}

// --- excluir -------------------------------------------------------------
const excluir = reactive({ aberto: false, senha: '', enviando: false, erro: '' });
async function excluirConta() {
  if (
    !confirm('Excluir sua conta? Galerias saem do ar e o desktop desconecta. Não dá pra desfazer.')
  )
    return;
  excluir.enviando = true;
  excluir.erro = '';
  try {
    await api('/me/excluir', { method: 'POST', body: { senha: excluir.senha } });
    sessao.limpar();
    await navigateTo('/entrar');
  } catch (e) {
    const apiErro = lerErroApi(e);
    excluir.erro =
      apiErro.codigo === 'CREDENCIAIS_INVALIDAS' ? 'Senha incorreta' : apiErro.mensagem;
  } finally {
    excluir.enviando = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Conta</h1>
      <p class="text-sm text-muted">Login, e-mail e senha. O @{{ sessao.conta?.slug }} não muda.</p>
    </div>

    <form @submit.prevent="salvarDados">
      <UiCartao titulo="Seus dados">
        <template #acoes>
          <UiBotao type="submit" :disabled="salvandoDados">Salvar</UiBotao>
        </template>
        <div class="space-y-4">
          <UiAlerta v-if="msgDados" :tipo="msgDados.tipo">{{ msgDados.texto }}</UiAlerta>
          <UiAlerta v-else-if="sessao.conta && !sessao.conta.emailVerificado" tipo="aviso">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>E-mail ainda não confirmado.</span>
              <button
                type="button"
                class="font-medium hover:underline disabled:opacity-60"
                :disabled="reenviando || reenviado"
                @click="reenviarVerificacao"
              >
                {{ reenviado ? 'Enviado!' : 'Reenviar confirmação' }}
              </button>
            </div>
          </UiAlerta>
          <UiCampo v-model="dados.nome" rotulo="Nome" required :erro="errosDados.nome" />
          <UiCampo
            v-model="dados.email"
            rotulo="E-mail"
            type="email"
            autocomplete="email"
            required
            :erro="errosDados.email"
            ajuda="Trocar o e-mail pede confirmação no endereço novo."
          />
        </div>
      </UiCartao>
    </form>

    <form @submit.prevent="salvarSenha">
      <UiCartao
        titulo="Senha"
        descricao="Trocar a senha desconecta as outras sessões e o desktop (uma vez)."
      >
        <template #acoes>
          <UiBotao type="submit" :disabled="salvandoSenha">Alterar senha</UiBotao>
        </template>
        <div class="space-y-4">
          <UiAlerta v-if="msgSenha" :tipo="msgSenha.tipo">{{ msgSenha.texto }}</UiAlerta>
          <UiCampo
            v-model="senha.atual"
            rotulo="Senha atual"
            type="password"
            autocomplete="current-password"
            required
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <UiCampo
              v-model="senha.nova"
              rotulo="Nova senha"
              type="password"
              autocomplete="new-password"
              required
            />
            <UiCampo
              v-model="senha.confirmacao"
              rotulo="Repita a nova senha"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>
        </div>
      </UiCartao>
    </form>

    <UiCartao titulo="Excluir conta" descricao="Sai da vitrine, desconecta o desktop. Sem volta.">
      <template #acoes>
        <UiBotao v-if="!excluir.aberto" variante="secundaria" @click="excluir.aberto = true">
          Quero excluir
        </UiBotao>
      </template>
      <form v-if="excluir.aberto" class="space-y-4" @submit.prevent="excluirConta">
        <UiAlerta v-if="excluir.erro" tipo="erro">{{ excluir.erro }}</UiAlerta>
        <UiCampo
          v-model="excluir.senha"
          rotulo="Confirme com sua senha"
          type="password"
          autocomplete="current-password"
          required
        />
        <div class="flex gap-2">
          <UiBotao
            type="submit"
            class="!bg-danger hover:!bg-danger/80"
            :disabled="excluir.enviando"
          >
            Excluir minha conta
          </UiBotao>
          <UiBotao variante="fantasma" @click="excluir.aberto = false">Cancelar</UiBotao>
        </div>
      </form>
    </UiCartao>
  </div>
</template>
