<script setup lang="ts">
definePageMeta({ layout: 'vazio', middleware: 'convidado' });
useSeoMeta({ title: 'Entrar' });

const sessao = useSessao();
const rota = useRoute();
const email = ref('');
const senha = ref('');
const enviando = ref(false);
const erro = ref('');

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
      falha.codigo === 'PAINEL_ERRADO'
        ? 'Esta é uma conta de administrador — entre pelo painel admin.'
        : falha.mensagem;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <form class="card mt-6 space-y-4 p-6" @submit.prevent="enviar">
    <div>
      <h1 class="text-lg font-semibold">Área do fotógrafo</h1>
      <p class="mt-0.5 text-sm text-muted">Entre pra ver galerias, vendas e sua conta.</p>
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>

    <UiCampo
      v-model="email"
      rotulo="E-mail"
      type="email"
      autocomplete="email"
      required
      placeholder="voce@estudio.com.br"
    />
    <UiCampo
      v-model="senha"
      rotulo="Senha"
      type="password"
      autocomplete="current-password"
      required
      placeholder="••••••••"
    >
      <template #acao>
        <NuxtLink
          to="/recuperar-senha"
          class="normal-case tracking-normal text-wine-tint hover:underline"
        >
          Esqueci a senha
        </NuxtLink>
      </template>
    </UiCampo>

    <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">
      {{ enviando ? 'Entrando…' : 'Entrar' }}
    </UiBotao>

    <p class="text-center text-sm text-muted">
      Ainda não tem conta?
      <NuxtLink to="/criar-conta" class="text-wine-tint hover:underline"
        >Criar conta grátis</NuxtLink
      >
    </p>
  </form>

  <p class="mt-6 text-center text-xs text-muted/70">
    Comprador de fotos? Você não precisa de conta —
    <a :href="`${$config.public.webUrl}/eventos`" class="text-wine-tint hover:underline">
      ache seu evento </a
    >.
  </p>
</template>
