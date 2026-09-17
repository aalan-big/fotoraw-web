<script setup lang="ts">
withDefaults(
  defineProps<{
    variante?: 'primaria' | 'secundaria' | 'fantasma';
    tamanho?: 'md' | 'lg';
    to?: string;
    type?: 'button' | 'submit';
  }>(),
  { variante: 'primaria', tamanho: 'md', type: 'button' },
);

const classes = {
  primaria: 'bg-primaria text-white hover:bg-primaria-clara',
  secundaria: 'bg-card-2 text-texto border border-borda-2 hover:border-texto-3',
  fantasma: 'text-texto-2 hover:text-texto hover:bg-card-2',
};
const tamanhos = { md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
</script>

<template>
  <component
    :is="to ? resolveComponent('NuxtLink') : 'button'"
    :to="to"
    :type="to ? undefined : type"
    class="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
    :class="[classes[variante], tamanhos[tamanho]]"
  >
    <slot />
  </component>
</template>
