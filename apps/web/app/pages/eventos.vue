<script setup lang="ts">
import type { GaleriaPublica } from '~/types/galeria';

useSeoMeta({ title: 'Eventos', description: 'Todas as galerias públicas publicadas no FotoRAW.' });

const api = useApi();
const rota = useRoute();
const busca = ref(String(rota.query.q ?? ''));

const { data: galerias, status } = await useAsyncData(
  () => `galerias-${rota.query.q ?? ''}`,
  () =>
    api<GaleriaPublica[]>('/publico/galerias', {
      query: { limite: 48, q: rota.query.q || undefined },
    }),
  { default: () => [], watch: [() => rota.query.q] },
);

function buscar() {
  const q = busca.value.trim();
  navigateTo({ path: '/eventos', query: q ? { q } : {} });
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-16">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Eventos</h1>
        <p class="mt-1 text-sm text-muted/80">
          <template v-if="rota.query.q">Resultados para “{{ rota.query.q }}”</template>
          <template v-else>Todas as galerias públicas</template>
        </p>
      </div>
      <form class="flex gap-2" @submit.prevent="buscar">
        <input
          v-model="busca"
          type="search"
          placeholder="Evento ou fotógrafo"
          class="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted/70 focus:border-wine md:w-72"
        />
        <UiBotao type="submit">Buscar</UiBotao>
      </form>
    </div>

    <div v-if="status === 'pending'" class="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <GaleriaCartaoEsqueleto v-for="i in 6" :key="i" />
    </div>
    <div v-else-if="galerias.length" class="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <GaleriaCartao v-for="g in galerias" :key="g.id" :galeria="g" />
    </div>
    <div v-else class="card mt-12 px-6 py-16 text-center">
      <p class="font-medium">Nada encontrado</p>
      <p class="mt-1 text-sm text-muted/80">
        Tente outro nome ou peça o link direto pro fotógrafo.
      </p>
    </div>
  </div>
</template>
