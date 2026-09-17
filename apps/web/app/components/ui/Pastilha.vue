<script setup lang="ts">
// Quadradinho com ícone, igual às pastilhas do painel do desktop.
withDefaults(defineProps<{ cor?: 'primaria' | 'amarelo' | 'azul' | 'roxo' | 'verde' }>(), {
  cor: 'primaria',
});

const cores = {
  primaria: 'bg-primaria-suave text-primaria-clara',
  amarelo: 'bg-amarelo-suave text-amarelo',
  azul: 'bg-azul-suave text-azul',
  roxo: 'bg-roxo-suave text-roxo',
  verde: 'bg-verde-suave text-verde',
};
</script>

<template>
  <span class="pastilha" :class="cores[cor]">
    <slot />
  </span>
</template>
