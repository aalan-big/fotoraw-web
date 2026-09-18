<script setup lang="ts">
import { NuxtLink } from '#components';

defineProps<{
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  to?: string;
  alerta?: boolean;
}>();
const base = 'card block p-4 transition-colors';
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :class="[base, 'hover:border-wine/50', { 'border-warning/40': alerta }]"
  >
    <p class="rotulo">{{ rotulo }}</p>
    <p class="text-2xl font-semibold tabular-nums" :class="{ 'text-warning': alerta }">
      {{ valor }}
    </p>
    <p v-if="detalhe" class="text-xs text-muted">{{ detalhe }}</p>
  </NuxtLink>
  <div v-else :class="[base, { 'border-warning/40': alerta }]">
    <p class="rotulo">{{ rotulo }}</p>
    <p class="text-2xl font-semibold tabular-nums" :class="{ 'text-warning': alerta }">
      {{ valor }}
    </p>
    <p v-if="detalhe" class="text-xs text-muted">{{ detalhe }}</p>
  </div>
</template>
