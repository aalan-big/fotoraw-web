<script setup lang="ts">
definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Financeiro' });
</script>

<template>
  <UiEmBreve
    titulo="Financeiro"
    descricao="Saldo a receber, extrato de repasses e conexão com o Mercado Pago."
    onde-hoje="Dados fiscais e Pix já dá pra preencher em Perfil público."
  />
</template>
