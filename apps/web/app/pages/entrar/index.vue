<script setup lang="ts">
definePageMeta({ layout: 'vazio' });
useSeoMeta({ title: 'Entrar' });

// Só visual por enquanto: o envio passa a funcionar quando o módulo `auth`
// do server existir. Deixei os campos prontos pra não redesenhar depois.
const email = ref('');
const senha = ref('');
const enviando = ref(false);
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
    <div class="absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center" />
    <div class="absolute inset-0 bg-bg/55" />

    <div class="relative w-full max-w-sm">
      <NuxtLink to="/" class="mx-auto block w-fit">
        <UiLogo class="h-36" />
      </NuxtLink>

      <form class="card mt-6 space-y-4 p-6" @submit.prevent>
        <div>
          <h1 class="text-lg font-semibold">Área do fotógrafo</h1>
          <p class="mt-0.5 text-sm text-muted">Entre pra ver galerias e pedidos.</p>
        </div>

        <label class="block">
          <span class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
            E-mail
          </span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="h-11 w-full rounded-lg border border-border bg-bg px-3 outline-none placeholder:text-muted/60 focus:border-wine focus:ring-2 focus:ring-wine-dim"
            placeholder="voce@estudio.com.br"
          />
        </label>

        <label class="block">
          <span
            class="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted"
          >
            Senha
            <NuxtLink
              to="/entrar"
              class="normal-case tracking-normal text-wine-tint hover:underline"
            >
              Esqueci a senha
            </NuxtLink>
          </span>
          <input
            v-model="senha"
            type="password"
            autocomplete="current-password"
            required
            class="h-11 w-full rounded-lg border border-border bg-bg px-3 outline-none placeholder:text-muted/60 focus:border-wine focus:ring-2 focus:ring-wine-dim"
            placeholder="••••••••"
          />
        </label>

        <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">Entrar</UiBotao>

        <p class="text-center text-sm text-muted">
          Ainda não tem conta?
          <NuxtLink to="/entrar" class="text-wine-tint hover:underline"
            >Criar conta grátis</NuxtLink
          >
        </p>
      </form>

      <p class="mt-6 text-center text-xs text-muted/70">
        Comprador de fotos? Você não precisa de conta —
        <NuxtLink to="/eventos" class="text-wine-tint hover:underline">ache seu evento</NuxtLink>.
      </p>
    </div>
  </div>
</template>
