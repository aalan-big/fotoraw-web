<script setup lang="ts">
withDefaults(defineProps<{ tipo?: 'erro' | 'sucesso' | 'aviso' | 'info' }>(), { tipo: 'info' });

const cores = {
  erro: 'border-danger/40 bg-danger/10 text-danger',
  sucesso: 'border-success/40 bg-success/10 text-success',
  aviso: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-info/40 bg-info/10 text-info',
};
</script>

<template>
  <div role="alert" class="rounded-lg border px-3 py-2.5 text-sm" :class="cores[tipo]">
    <slot />
  </div>
</template>
