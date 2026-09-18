<script setup lang="ts">
/** Casca de tabela: rolagem horizontal no mobile, cabeçalho em caixa alta. */
defineProps<{ vazio?: string; carregando?: boolean }>();
</script>

<template>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead
          class="bg-bg/60 text-left text-[11px] font-medium uppercase tracking-wide text-muted"
        >
          <slot name="cabecalho" />
        </thead>
        <tbody class="divide-y divide-border">
          <slot />
        </tbody>
      </table>
    </div>
    <p v-if="carregando" class="px-4 py-6 text-center text-sm text-muted">Carregando…</p>
    <p v-else-if="vazio" class="px-4 py-8 text-center text-sm text-muted">{{ vazio }}</p>
  </div>
</template>
