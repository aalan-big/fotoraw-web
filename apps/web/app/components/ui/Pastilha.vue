<script setup lang="ts">
// Quadradinho com ícone, igual às pastilhas do painel do desktop.
// Cores semânticas: vinho (marca) ou estado — nunca decoração.
withDefaults(defineProps<{ cor?: 'wine' | 'warning' | 'info' | 'success' | 'danger' }>(), {
  cor: 'wine',
});

const cores = {
  wine: 'bg-wine-dim text-wine-tint',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
};
</script>

<template>
  <span class="pastilha" :class="cores[cor]">
    <slot />
  </span>
</template>
