<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Financeiro' });
</script>

<template>
  <UiEmBreve
    titulo="Financeiro"
    descricao="Vendas, comissão da plataforma e fila de repasses."
    onde-hoje="Passo 4 — depende das vendas existirem (Mercado Pago)."
  />
</template>
