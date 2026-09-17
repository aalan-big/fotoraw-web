<script setup lang="ts">
import { type GaleriaPublica, rotuloCategoria } from '~/types/galeria';

const props = defineProps<{ galeria: GaleriaPublica }>();

// Portfólio de ensaio leva pro perfil do fotógrafo (é venda de serviço, não de foto).
const ensaio = computed(() => props.galeria.modalidade !== 'EVENTO');
const destino = computed(() =>
  ensaio.value
    ? `/@${props.galeria.conta.slug}`
    : `/@${props.galeria.conta.slug}/${props.galeria.slug}`,
);
const disponivel = computed(() => props.galeria.totalFotos > 0);
const local = computed(() => [props.galeria.cidade, props.galeria.uf].filter(Boolean).join('/'));
const data = computed(() =>
  props.galeria.dataEvento
    ? formatarData(props.galeria.dataEvento, { day: '2-digit', month: 'short', year: 'numeric' })
    : null,
);

const copiado = ref(false);
async function compartilhar(e: Event) {
  e.preventDefault();
  const url = `${location.origin}${destino.value}`;
  if (navigator.share) {
    await navigator.share({ title: props.galeria.titulo, url }).catch(() => {});
    return;
  }
  await navigator.clipboard.writeText(url);
  copiado.value = true;
  setTimeout(() => (copiado.value = false), 1500);
}
</script>

<template>
  <NuxtLink
    :to="destino"
    class="group relative block aspect-3/4 overflow-hidden rounded-xl border border-border bg-surface transition-all hover:-translate-y-1 hover:border-wine/60 hover:shadow-[0_20px_50px_-20px_rgba(134,18,34,0.6)]"
  >
    <!-- capa em tela cheia -->
    <img
      v-if="galeria.capaUrl"
      :src="galeria.capaUrl"
      :alt="galeria.titulo"
      class="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
      loading="lazy"
    />
    <div v-else class="absolute inset-0">
      <div
        class="absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center opacity-70"
      />
      <svg
        class="absolute left-1/2 top-[30%] size-12 -translate-x-1/2 text-text/35"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    </div>

    <!-- escurece de baixo pra cima pra o painel ler bem -->
    <div class="absolute inset-0 bg-linear-to-t from-bg via-bg/60 to-transparent" />

    <!-- compartilhar -->
    <button
      type="button"
      class="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-bg/70 text-text backdrop-blur transition-colors hover:bg-wine"
      :aria-label="copiado ? 'Link copiado' : 'Compartilhar'"
      @click="compartilhar"
    >
      <svg
        v-if="!copiado"
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      <svg
        v-else
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 12l5 5L19 7" />
      </svg>
    </button>

    <!-- painel de informação -->
    <div class="absolute inset-x-0 bottom-0 p-5">
      <div class="mb-3 flex flex-wrap items-center gap-2.5">
        <span
          class="rounded-md bg-wine px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
        >
          {{ rotuloCategoria[galeria.categoria] }}
        </span>
        <span v-if="data" class="flex items-center gap-1 text-xs text-text/80">
          <svg
            class="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          {{ data }}
        </span>
      </div>

      <h3 class="text-xl font-bold uppercase leading-tight tracking-tight">{{ galeria.titulo }}</h3>

      <p class="mt-2 flex items-center gap-1 text-sm text-muted">
        <svg
          class="size-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span class="truncate">{{ local || galeria.conta.nome }}</span>
      </p>

      <div class="mt-5 flex items-end justify-between gap-4 border-t border-text/10 pt-4">
        <div class="min-w-0">
          <p
            class="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide"
          >
            <span class="size-1.5 rounded-full" :class="disponivel ? 'bg-success' : 'bg-warning'" />
            <span :class="disponivel ? 'text-success' : 'text-warning'">
              {{ ensaio ? 'Portfólio' : disponivel ? 'Fotos disponíveis' : 'Em breve' }}
            </span>
          </p>
          <p
            v-if="galeria.precoFotoCentavos"
            class="mt-1 text-[11px] uppercase tracking-wide text-muted"
          >
            A partir de
            <span class="block text-base font-bold text-wine-tint">
              {{ formatarCentavos(galeria.precoFotoCentavos) }}
            </span>
          </p>
          <p v-else-if="ensaio" class="mt-1 text-[11px] uppercase tracking-wide text-muted">
            Por
            <span class="block truncate text-sm font-semibold text-text">{{
              galeria.conta.nome
            }}</span>
          </p>
        </div>
        <span
          class="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-wine px-3.5 text-sm font-semibold text-white transition-colors group-hover:bg-wine-hover"
        >
          {{ ensaio ? 'Ver fotógrafo' : 'Ver fotos' }}
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
