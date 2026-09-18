<script setup lang="ts">
import { NuxtLink } from '#components';

/**
 * Botão ou link com cara de botão. Com `to` vira NuxtLink (rota interna ou URL
 * externa — o NuxtLink cuida dos dois); sem `to` é <button>.
 */
withDefaults(
  defineProps<{
    variante?: 'primaria' | 'secundaria' | 'fantasma';
    tamanho?: 'md' | 'lg';
    to?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
  }>(),
  { variante: 'primaria', tamanho: 'md', type: 'button' },
);

const classes = {
  primaria: 'bg-wine text-white hover:bg-wine-hover',
  secundaria: 'bg-surface-2 text-text border border-border hover:border-muted/40',
  fantasma: 'text-muted hover:text-text hover:bg-surface-2',
};
const tamanhos = { md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine disabled:cursor-not-allowed disabled:opacity-50';
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="[base, classes[variante], tamanhos[tamanho]]">
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :disabled="disabled"
    :class="[base, classes[variante], tamanhos[tamanho]]"
  >
    <slot />
  </button>
</template>
