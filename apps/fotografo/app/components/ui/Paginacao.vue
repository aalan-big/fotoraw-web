<script setup lang="ts">
const props = defineProps<{
  pagina: number;
  porPagina: number;
  total: number;
}>();

const emit = defineEmits<{
  (e: 'update:pagina', n: number): void;
}>();

const paginas = computed(() => Math.max(1, Math.ceil(props.total / props.porPagina)));
</script>

<template>
  <div v-if="paginas > 1" class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
    <span>
      Mostrando {{ (pagina - 1) * porPagina + 1 }}–{{ Math.min(pagina * porPagina, total) }} de
      <strong class="text-text">{{ total }}</strong> registros · página {{ pagina }} de {{ paginas }}
    </span>
    <div class="flex items-center gap-2">
      <UiBotao
        variante="secundaria"
        :disabled="pagina <= 1"
        class="text-xs"
        @click="emit('update:pagina', pagina - 1)"
      >
        Anterior
      </UiBotao>
      <UiBotao
        variante="secundaria"
        :disabled="pagina >= paginas"
        class="text-xs"
        @click="emit('update:pagina', pagina + 1)"
      >
        Próxima
      </UiBotao>
    </div>
  </div>
</template>
