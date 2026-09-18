<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Assinaturas' });
</script>

<template>
  <UiEmBreve
    titulo="Assinaturas"
    descricao="Assinaturas e faturas; marcar paga; cancelar."
    onde-hoje="Passo 4 — a parte automática chega com a Stripe."
  />
</template>
