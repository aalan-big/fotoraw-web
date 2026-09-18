<script setup lang="ts">
defineProps<{ titulo?: string; descricao?: string }>();
</script>

<template>
  <section class="card p-5">
    <header v-if="titulo || $slots.acoes" class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 v-if="titulo" class="text-base font-semibold">{{ titulo }}</h2>
        <p v-if="descricao" class="mt-0.5 text-sm text-muted">{{ descricao }}</p>
      </div>
      <slot name="acoes" />
    </header>
    <slot />
  </section>
</template>
