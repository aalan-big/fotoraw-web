<script setup lang="ts">
const sessao = useSessao();
const rota = useRoute();
const menuAberto = ref(false);
const menuUsuario = ref(false);
const caixa = ref<HTMLElement | null>(null);

interface Item {
  rotulo: string;
  to: string;
  icone: string;
  breve?: boolean;
}
const secoes: { titulo: string; itens: Item[] }[] = [
  {
    titulo: 'Operação',
    itens: [
      { rotulo: 'Visão geral', to: '/', icone: 'M3 12 12 4l9 8M5 10v10h14V10' },
      {
        rotulo: 'Fotógrafos',
        to: '/fotografos',
        icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
      },
      { rotulo: 'Licenças', to: '/licencas', icone: 'M7 3h10v18l-5-3-5 3zM9 7h6M9 10h6' },
    ],
  },
  {
    titulo: 'Negócio',
    itens: [
      {
        rotulo: 'Planos',
        to: '/planos',
        icone: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-2.7L7 19l1-6-4-4 5.5-.5z',
        breve: true,
      },
      { rotulo: 'Assinaturas', to: '/assinaturas', icone: 'M4 6h16v12H4zM4 10h16', breve: true },
      {
        rotulo: 'Financeiro',
        to: '/financeiro',
        icone: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
        breve: true,
      },
    ],
  },
  {
    titulo: 'Plataforma',
    itens: [
      {
        rotulo: 'Configurações',
        to: '/configuracoes',
        icone: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2',
        breve: true,
      },
      { rotulo: 'Auditoria', to: '/auditoria', icone: 'M4 5h16v14H4zM8 9h8M8 13h5', breve: true },
      {
        rotulo: 'Sistema',
        to: '/sistema',
        icone: 'M4 6h16v5H4zM4 13h16v5H4zM7 8.5h.01M7 15.5h.01',
        breve: true,
      },
      {
        rotulo: 'Admins',
        to: '/admins',
        icone: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0',
        breve: true,
      },
    ],
  },
];

const iniciais = computed(() =>
  (sessao.conta?.nome ?? '?')
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join(''),
);
watch(
  () => rota.fullPath,
  () => {
    menuAberto.value = false;
    menuUsuario.value = false;
  },
);
function foraDoMenu(e: MouseEvent) {
  if (menuUsuario.value && caixa.value && !caixa.value.contains(e.target as Node))
    menuUsuario.value = false;
}
onMounted(() => document.addEventListener('click', foraDoMenu));
onBeforeUnmount(() => document.removeEventListener('click', foraDoMenu));
</script>

<template>
  <div class="flex min-h-dvh">
    <div
      v-if="menuAberto"
      class="fixed inset-0 z-30 bg-black/60 lg:hidden"
      @click="menuAberto = false"
    />
    <aside
      class="fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform lg:sticky lg:top-0 lg:translate-x-0"
      :class="menuAberto ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center justify-between px-5">
        <NuxtLink to="/"><UiLogo variante="wordmark" /></NuxtLink>
        <span
          class="rounded-md bg-wine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white"
        >
          admin
        </span>
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
                <span class="flex-1">{{ item.rotulo }}</span>
                <span v-if="item.breve" class="text-[10px] uppercase tracking-wide opacity-60"
                  >breve</span
                >
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8"
      >
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="pastilha lg:hidden"
            aria-label="Abrir menu"
            @click="menuAberto = true"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div class="min-w-0">
            <div class="truncate font-semibold">Gestão da plataforma</div>
            <div class="truncate text-xs text-muted">uso interno · toda ação fica na auditoria</div>
          </div>
        </div>

        <div ref="caixa" class="relative">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border border-border bg-bg/60 py-1 pl-1 pr-2 hover:border-muted/40"
            aria-label="Menu do usuário"
            @click="menuUsuario = !menuUsuario"
          >
            <span
              class="flex size-8 items-center justify-center rounded-full bg-wine text-xs font-semibold text-white"
              >{{ iniciais }}</span
            >
            <svg
              viewBox="0 0 24 24"
              class="size-4 text-muted"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div
            v-if="menuUsuario"
            class="absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-surface shadow-xl shadow-black/40"
          >
            <div class="border-b border-border px-4 py-3">
              <p class="truncate text-sm font-medium">{{ sessao.conta?.nome }}</p>
              <p class="truncate text-xs text-muted">{{ sessao.conta?.email }}</p>
            </div>
            <button
              type="button"
              class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger hover:bg-danger/10"
              @click="sessao.sair()"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
</template>
