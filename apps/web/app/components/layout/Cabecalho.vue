<script setup lang="ts">
const aberto = ref(false);
const rota = useRoute();
watch(
  () => rota.fullPath,
  () => (aberto.value = false),
);

const itens = [
  { to: '/eventos', rotulo: 'Eventos' },
  { to: '/#como-funciona', rotulo: 'Como funciona' },
  { to: '/#fotografos', rotulo: 'Para fotógrafos' },
];

// Item ativo: mesmo tratamento do menu lateral do desktop (fundo vinho).
function ativo(to: string) {
  return to.startsWith('/#') ? false : rota.path === to || rota.path.startsWith(`${to}/`);
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
    <div class="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
      <NuxtLink to="/" class="flex items-center">
        <UiLogo variante="wordmark" />
      </NuxtLink>

      <nav class="hidden items-center gap-1 md:flex">
        <NuxtLink
          v-for="item in itens"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-4 py-2 text-[15px] font-medium transition-colors"
          :class="
            ativo(item.to)
              ? 'bg-wine text-white'
              : 'text-text/90 hover:bg-surface-2 hover:text-text'
          "
        >
          {{ item.rotulo }}
        </NuxtLink>

        <span class="mx-3 h-6 w-px bg-border" aria-hidden="true" />

        <UiBotao to="/entrar" variante="fantasma">Entrar</UiBotao>
        <UiBotao to="/entrar">Criar conta</UiBotao>
      </nav>

      <button
        type="button"
        class="rounded-lg p-2 text-text hover:bg-surface-2 md:hidden"
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

    <div v-if="aberto" class="border-t border-border bg-bg px-6 py-4 md:hidden">
      <nav class="flex flex-col gap-1">
        <NuxtLink
          v-for="item in itens"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-4 py-3 text-[15px] font-medium"
          :class="ativo(item.to) ? 'bg-wine text-white' : 'text-text hover:bg-surface-2'"
        >
          {{ item.rotulo }}
        </NuxtLink>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <UiBotao to="/entrar" variante="secundaria">Entrar</UiBotao>
          <UiBotao to="/entrar">Criar conta</UiBotao>
        </div>
      </nav>
    </div>
  </header>
</template>
