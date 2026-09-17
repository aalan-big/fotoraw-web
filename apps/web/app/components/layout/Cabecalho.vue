<script setup lang="ts">
const aberto = ref(false);
const rota = useRoute();
watch(
  () => rota.fullPath,
  () => (aberto.value = false),
);
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
      <NuxtLink to="/" class="flex items-center gap-2.5">
        <span
          class="flex size-9 items-center justify-center rounded-lg bg-wine text-sm font-bold text-white"
        >
          F
        </span>
        <span class="text-base font-semibold tracking-tight">FotoRAW</span>
      </NuxtLink>

      <nav class="hidden items-center gap-1 md:flex">
        <NuxtLink
          to="/eventos"
          class="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
          active-class="text-text"
        >
          Eventos
        </NuxtLink>
        <NuxtLink
          to="/#como-funciona"
          class="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          Como funciona
        </NuxtLink>
        <NuxtLink
          to="/#fotografos"
          class="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          Para fotógrafos
        </NuxtLink>
        <UiBotao to="/entrar" variante="secundaria" class="ml-2">Entrar</UiBotao>
      </nav>

      <button
        type="button"
        class="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text md:hidden"
        :aria-expanded="aberto"
        aria-label="Abrir menu"
        @click="aberto = !aberto"
      >
        <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path v-if="!aberto" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
          <path v-else stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div v-if="aberto" class="border-t border-border bg-bg px-4 py-3 md:hidden">
      <nav class="flex flex-col gap-1">
        <NuxtLink to="/eventos" class="rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
          >Eventos</NuxtLink
        >
        <NuxtLink to="/#como-funciona" class="rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
          Como funciona
        </NuxtLink>
        <NuxtLink to="/#fotografos" class="rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
          Para fotógrafos
        </NuxtLink>
        <UiBotao to="/entrar" variante="secundaria" class="mt-2">Entrar</UiBotao>
      </nav>
    </div>
  </header>
</template>
