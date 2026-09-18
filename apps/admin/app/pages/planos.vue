<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Planos' });
</script>

<template>
  <UiEmBreve
    titulo="Planos"
    descricao="Editar preço, limites e flags dos planos; reemitir licenças ativas."
    onde-hoje="Passo 3 do ambiente admin. Hoje os limites vêm do seed (migrations 5 e 10)."
  />
</template>
