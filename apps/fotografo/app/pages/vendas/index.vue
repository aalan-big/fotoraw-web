<script setup lang="ts">
definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Vendas' });
</script>

<template>
  <UiEmBreve
    titulo="Vendas"
    descricao="Pedidos por galeria e período, comprador, itens, comissão e repasse."
    onde-hoje="Chega junto com a vitrine de vendas."
  />
</template>
