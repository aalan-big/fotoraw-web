<script setup lang="ts">
defineProps<{ aberto: boolean }>();
defineEmits<{ fechar: [] }>();

const sessao = useSessao();

/** Mesma organização do desktop: seções, item ativo em vinho. */
const secoes = [
  {
    titulo: 'Vitrine',
    itens: [
      { rotulo: 'Início', to: '/', icone: 'M3 12 12 4l9 8M5 10v10h14V10' },
      { rotulo: 'Galerias', to: '/galerias', icone: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5' },
      { rotulo: 'Vendas', to: '/vendas', icone: 'M4 6h16l-1.5 9h-13zM8 20h.01M16 20h.01' },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      {
        rotulo: 'Financeiro',
        to: '/financeiro',
        icone: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
      },
      {
        rotulo: 'Plano',
        to: '/plano',
        icone: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-2.7L7 19l1-6-4-4 5.5-.5z',
      },
    ],
  },
  {
    titulo: 'Conta',
    itens: [
      {
        rotulo: 'Perfil público',
        to: '/perfil',
        icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
      },
      { rotulo: 'Dispositivos', to: '/dispositivos', icone: 'M3 5h18v11H3zM8 20h8' },
      {
        rotulo: 'Conta',
        to: '/conta',
        icone:
          'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z',
      },
    ],
  },
];
</script>

<template>
  <!-- fundo escuro no mobile -->
  <div v-if="aberto" class="fixed inset-0 z-30 bg-black/60 lg:hidden" @click="$emit('fechar')" />
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0"
    :class="aberto ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="flex h-16 items-center px-5">
      <NuxtLink to="/"><UiLogo variante="wordmark" /></NuxtLink>
    </div>

    <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      <div v-for="secao in secoes" :key="secao.titulo">
        <p class="rotulo px-3">{{ secao.titulo }}</p>
        <ul class="space-y-0.5">
          <li v-for="item in secao.itens" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
              active-class="!bg-wine !text-white"
              @click="$emit('fechar')"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4.5 shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path :d="item.icone" />
              </svg>
              {{ item.rotulo }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="border-t border-border p-3">
      <div class="truncate px-3 text-sm">{{ sessao.conta?.nome }}</div>
      <div class="truncate px-3 text-xs text-muted">@{{ sessao.conta?.slug }}</div>
      <button
        type="button"
        class="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-text"
        @click="sessao.sair()"
      >
        Sair
      </button>
    </div>
  </aside>
</template>
