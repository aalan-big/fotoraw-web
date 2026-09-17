<script setup lang="ts">
useSeoMeta({
  title: 'Acessar meu ensaio',
  description: 'Entre na sua galeria privada com o código que o fotógrafo enviou.',
});

// Só visual por enquanto: o acesso passa a funcionar com o módulo `galerias`
// (galeria PRIVADA + senha). O código é o que vai no link do WhatsApp.
const codigo = ref('');
const senha = ref('');
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col px-6 py-20">
    <UiPastilha cor="info" class="size-12">
      <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    </UiPastilha>
    <h1 class="mt-5 text-2xl font-semibold">Acessar meu ensaio</h1>
    <p class="mt-2 text-muted">
      Seu fotógrafo te mandou um link ou um código. Se abriu pelo link, você já está na galeria; se
      tem só o código, digite aqui.
    </p>

    <form class="card mt-8 space-y-4 p-6" @submit.prevent>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
          Código do ensaio
        </span>
        <input
          v-model="codigo"
          type="text"
          autocomplete="off"
          autocapitalize="characters"
          required
          placeholder="Ex.: LUZ-4821"
          class="h-11 w-full rounded-lg border border-border bg-bg px-3 uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:border-wine focus:ring-2 focus:ring-wine-dim"
        />
      </label>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
          Senha <span class="normal-case tracking-normal">(se o fotógrafo definiu)</span>
        </span>
        <input
          v-model="senha"
          type="password"
          autocomplete="off"
          placeholder="••••••"
          class="h-11 w-full rounded-lg border border-border bg-bg px-3 outline-none placeholder:text-muted/60 focus:border-wine focus:ring-2 focus:ring-wine-dim"
        />
      </label>
      <UiBotao type="submit" tamanho="lg" class="w-full">Abrir minha galeria</UiBotao>
    </form>

    <p class="mt-6 text-sm text-muted/80">
      Não achou o código? Ele está na mensagem que o fotógrafo mandou, junto com o link. Na dúvida,
      fale com ele — a galeria é privada e só ele pode reenviar.
    </p>
  </div>
</template>
