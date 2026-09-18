<script setup lang="ts">
defineProps<{ titulo: string; descricao: string; ondeHoje?: string }>();
</script>

<template>
  <div class="card mx-auto max-w-lg p-8 text-center">
    <p class="rotulo">em breve</p>
    <h1 class="text-xl font-semibold">{{ titulo }}</h1>
    <p class="mt-2 text-sm text-muted">{{ descricao }}</p>
    <p v-if="ondeHoje" class="mt-4 rounded-lg bg-wine-dim px-3 py-2 text-sm">{{ ondeHoje }}</p>
  </div>
</template>
