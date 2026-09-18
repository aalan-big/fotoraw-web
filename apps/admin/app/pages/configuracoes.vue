<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Configurações' });
</script>

<template>
  <UiEmBreve
    titulo="Configurações"
    descricao="trial_dias, comissão padrão, downloads, e-mails."
    onde-hoje="Passo 3. Hoje: tabela configuracoes_plataforma no banco."
  />
</template>
