<script setup lang="ts">
const props = defineProps<{ pagina: number; porPagina: number; total: number }>();
const emit = defineEmits<{ 'update:pagina': [n: number] }>();
const paginas = computed(() => Math.max(1, Math.ceil(props.total / props.porPagina)));
</script>

<template>
  <div v-if="paginas > 1" class="flex items-center justify-between text-sm text-muted">
    <span>{{ total }} no total · página {{ pagina }} de {{ paginas }}</span>
    <div class="flex gap-2">
      <UiBotao
        variante="secundaria"
        :disabled="pagina <= 1"
        @click="emit('update:pagina', pagina - 1)"
        >Anterior</UiBotao
      >
      <UiBotao
        variante="secundaria"
        :disabled="pagina >= paginas"
        @click="emit('update:pagina', pagina + 1)"
        >Próxima</UiBotao
      >
    </div>
  </div>
</template>
