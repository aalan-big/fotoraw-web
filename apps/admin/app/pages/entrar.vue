<script setup lang="ts">
definePageMeta({ layout: 'vazio', middleware: 'convidado' });
useSeoMeta({ title: 'Entrar' });

const sessao = useSessao();
const rota = useRoute();
const email = ref('');
const senha = ref('');
const enviando = ref(false);
const erro = ref(rota.query.semPermissao ? 'Esta conta não é de administrador.' : '');

async function enviar() {
  enviando.value = true;
  erro.value = '';
  try {
    await sessao.entrar(email.value, senha.value);
    const voltar = typeof rota.query.voltar === 'string' ? rota.query.voltar : '/';
    await navigateTo(voltar.startsWith('/') ? voltar : '/');
  } catch (e) {
    const falha = lerErroApi(e);
    erro.value =
      falha.codigo === 'PAINEL_ERRADO' ? 'Esta conta não é de administrador.' : falha.mensagem;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <form class="card mt-6 space-y-4 p-6" @submit.prevent="enviar">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold">Gestão da plataforma</h1>
        <p class="mt-0.5 text-sm text-muted">Acesso restrito a administradores.</p>
      </div>
      <span
        class="rounded-md bg-wine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white"
        >admin</span
      >
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>

    <UiCampo v-model="email" rotulo="E-mail" type="email" autocomplete="username" required />
    <UiCampo
      v-model="senha"
      rotulo="Senha"
      type="password"
      autocomplete="current-password"
      required
    />

    <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">
      {{ enviando ? 'Entrando…' : 'Entrar' }}
    </UiBotao>
  </form>
</template>
