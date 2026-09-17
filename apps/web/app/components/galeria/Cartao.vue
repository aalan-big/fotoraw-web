<script setup lang="ts">
import type { GaleriaPublica } from '~/types/galeria';

const props = defineProps<{ galeria: GaleriaPublica }>();
const destino = computed(() => `/@${props.galeria.conta.slug}/${props.galeria.slug}`);
</script>

<template>
  <NuxtLink
    :to="destino"
    class="card group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:border-wine/60 hover:shadow-[0_12px_40px_-12px_rgba(134,18,34,0.45)]"
  >
    <!-- capa -->
    <div class="relative aspect-[4/3] overflow-hidden bg-surface-2">
      <img
        v-if="galeria.capaUrl"
        :src="galeria.capaUrl"
        :alt="galeria.titulo"
        class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <!-- sem capa: fundo da marca bem escuro + ícone -->
      <div v-else class="relative size-full">
        <div
          class="absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center opacity-60"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <svg
          class="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-text/40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </div>

      <!-- gradiente pra legibilidade das etiquetas -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-bg/70 to-transparent"
      />

      <span
        class="absolute left-3 top-3 rounded-md bg-wine px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
      >
        {{ galeria.tipo === 'EVENTO' ? 'Evento' : 'Privada' }}
      </span>
      <span
        class="absolute right-3 top-3 rounded-md bg-bg/80 px-2 py-0.5 text-xs font-medium text-text backdrop-blur"
      >
        {{ galeria.totalFotos > 0 ? `${galeria.totalFotos} fotos` : 'Em breve' }}
      </span>
    </div>

    <!-- texto -->
    <div class="flex flex-1 flex-col p-5">
      <h3 class="text-[17px] font-semibold leading-snug">{{ galeria.titulo }}</h3>
      <p class="mt-1 text-sm text-muted">
        {{ formatarData(galeria.publicadaEm, { year: 'numeric' }) }}
      </p>

      <div class="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span class="flex min-w-0 items-center gap-2.5">
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-wine-dim text-[11px] font-bold text-wine-tint"
          >
            {{ iniciais(galeria.conta.nome) }}
          </span>
          <span class="truncate text-sm text-muted">{{ galeria.conta.nome }}</span>
        </span>
        <span
          class="shrink-0 text-sm font-medium text-wine-tint opacity-0 transition-opacity group-hover:opacity-100"
        >
          Ver fotos →
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
