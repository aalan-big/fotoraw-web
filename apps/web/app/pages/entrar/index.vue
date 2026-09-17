<script setup lang="ts">
useSeoMeta({ title: 'Entrar' });
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
    <span
      class="flex size-12 items-center justify-center rounded-xl bg-wine text-lg font-bold text-white"
    >
      F
    </span>
    <h1 class="mt-5 text-2xl font-semibold">Área do fotógrafo</h1>
    <p class="mt-2 text-sm text-muted/80">
      Login e cadastro entram no próximo passo (módulo <code>contas</code> do server).
    </p>
    <UiBotao to="/" variante="secundaria" class="mt-8">Voltar pro início</UiBotao>
  </div>
</template>
