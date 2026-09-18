<script setup lang="ts">
defineEmits<{ abrirMenu: [] }>();
const sessao = useSessao();

// --- licença -------------------------------------------------------------
const licenca = computed(() => sessao.eu?.licenca ?? null);
const rotuloLicenca = computed(() => {
  const l = licenca.value;
  if (!l) return '';
  if (l.plano === 'gratuito') return 'Plano gratuito';
  if (l.plano === 'trial')
    return `Trial · ${l.diasRestantes} ${l.diasRestantes === 1 ? 'dia' : 'dias'}`;
  return l.diasRestantes === null ? 'PRO' : `PRO · vence em ${l.diasRestantes} dias`;
});
const corLicenca = computed(() => {
  const d = licenca.value?.diasRestantes;
  if (d !== null && d !== undefined && d <= 7)
    return 'border-warning/40 bg-warning/10 text-warning';
  if (licenca.value?.plano === 'gratuito') return 'border-border bg-surface-2 text-muted';
  return 'border-wine/40 bg-wine-dim text-wine-tint';
});

// --- menu do usuário -------------------------------------------------------
const aberto = ref(false);
const caixa = ref<HTMLElement | null>(null);
const iniciais = computed(() =>
  (sessao.conta?.nome ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join(''),
);
const rota = useRoute();
watch(
  () => rota.fullPath,
  () => (aberto.value = false),
);

function foraDoMenu(e: MouseEvent) {
  if (aberto.value && caixa.value && !caixa.value.contains(e.target as Node)) aberto.value = false;
}
function esc(e: KeyboardEvent) {
  if (e.key === 'Escape') aberto.value = false;
}
onMounted(() => {
  document.addEventListener('click', foraDoMenu);
  document.addEventListener('keydown', esc);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', foraDoMenu);
  document.removeEventListener('keydown', esc);
});

const itens = [
  { rotulo: 'Minha conta', to: '/conta' },
  { rotulo: 'Perfil público', to: '/perfil' },
  { rotulo: 'Dispositivos', to: '/dispositivos' },
];
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8"
  >
    <div class="flex min-w-0 items-center gap-3">
      <button
        type="button"
        class="pastilha lg:hidden"
        aria-label="Abrir menu"
        @click="$emit('abrirMenu')"
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
        <div class="truncate font-semibold">
          {{ sessao.eu?.perfil?.nomeFantasia ?? sessao.conta?.nome }}
        </div>
        <div class="truncate text-xs text-muted">fotoraw.com.br/@{{ sessao.conta?.slug }}</div>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-3">
      <NuxtLink
        v-if="licenca"
        to="/plano"
        class="hidden rounded-full border px-3 py-1 text-xs font-medium sm:inline-block"
        :class="corLicenca"
      >
        {{ rotuloLicenca }}
      </NuxtLink>

      <div ref="caixa" class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border border-border bg-bg/60 py-1 pl-1 pr-2 transition-colors hover:border-muted/40"
          :aria-expanded="aberto"
          aria-haspopup="menu"
          aria-label="Menu do usuário"
          @click="aberto = !aberto"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full bg-wine text-xs font-semibold text-white"
          >
            {{ iniciais }}
          </span>
          <svg
            viewBox="0 0 24 24"
            class="size-4 text-muted transition-transform"
            :class="{ 'rotate-180': aberto }"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="scale-95 opacity-0"
          leave-active-class="transition duration-75 ease-in"
          leave-to-class="scale-95 opacity-0"
        >
          <div
            v-if="aberto"
            role="menu"
            class="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-lg border border-border bg-surface shadow-xl shadow-black/40"
          >
            <div class="border-b border-border px-4 py-3">
              <p class="truncate text-sm font-medium">{{ sessao.conta?.nome }}</p>
              <p class="truncate text-xs text-muted">{{ sessao.conta?.email }}</p>
              <NuxtLink
                v-if="licenca"
                to="/plano"
                class="mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium sm:hidden"
                :class="corLicenca"
              >
                {{ rotuloLicenca }}
              </NuxtLink>
            </div>
            <nav class="py-1">
              <NuxtLink
                v-for="i in itens"
                :key="i.to"
                :to="i.to"
                role="menuitem"
                class="block px-4 py-2 text-sm text-text/90 hover:bg-surface-2 hover:text-text"
              >
                {{ i.rotulo }}
              </NuxtLink>
            </nav>
            <div class="border-t border-border py-1">
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-danger/10"
                @click="sessao.sair()"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M10 17l5-5-5-5M15 12H3M13 3h6v18h-6" />
                </svg>
                Sair
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
