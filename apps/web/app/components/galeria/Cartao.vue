<script setup lang="ts">
import type { GaleriaPublica } from '~/types/galeria';

const props = defineProps<{ galeria: GaleriaPublica }>();
const destino = computed(() => `/@${props.galeria.conta.slug}/${props.galeria.slug}`);
</script>

<template>
  <NuxtLink
    :to="destino"
    class="card group block overflow-hidden transition-colors hover:border-muted/40"
  >
    <div class="relative aspect-[4/3] overflow-hidden bg-surface-2">
      <img
        v-if="galeria.capaUrl"
        :src="galeria.capaUrl"
        :alt="galeria.titulo"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div
        v-else
        class="flex size-full items-center justify-center bg-gradient-to-br from-wine-dim to-surface-2 text-3xl font-bold text-wine-tint/70"
      >
        {{ iniciais(galeria.titulo) }}
      </div>
      <span
        class="absolute left-3 top-3 rounded-md bg-bg/80 px-2 py-0.5 text-xs font-medium text-muted backdrop-blur"
      >
        {{ galeria.totalFotos }} fotos
      </span>
    </div>
    <div class="p-5">
      <h3 class="truncate font-semibold">{{ galeria.titulo }}</h3>
      <p class="mt-2 flex items-center justify-between text-sm text-muted/80">
        <span class="truncate">@{{ galeria.conta.slug }}</span>
        <span>{{ formatarData(galeria.publicadaEm) }}</span>
      </p>
    </div>
  </NuxtLink>
</template>
