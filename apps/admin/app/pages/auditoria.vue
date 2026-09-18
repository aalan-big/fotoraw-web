<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Auditoria' });
</script>

<template>
  <UiEmBreve
    titulo="Auditoria"
    descricao="Log completo, filtrável por ator, ação, alvo e período."
    onde-hoje="Passo 5. Hoje: a aba Auditoria no detalhe de cada fotógrafo."
  />
</template>
