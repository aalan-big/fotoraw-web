<script setup lang="ts">
definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Galerias' });
</script>

<template>
  <UiEmBreve
    titulo="Galerias"
    descricao="Suas galerias publicadas: link, QR, código de acesso, pausar e encerrar."
    onde-hoje="Hoje: publique e edite pelo FotoRAW desktop."
  />
</template>
