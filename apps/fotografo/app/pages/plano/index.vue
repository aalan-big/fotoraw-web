<script setup lang="ts">
definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Plano' });
</script>

<template>
  <UiEmBreve
    titulo="Plano"
    descricao="Plano atual, licença, faturas e assinatura PRO."
    onde-hoje="Os limites do seu plano aparecem no Início."
  />
</template>
