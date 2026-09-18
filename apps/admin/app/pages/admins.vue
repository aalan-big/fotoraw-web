<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Admins' });
</script>

<template>
  <UiEmBreve
    titulo="Admins"
    descricao="Outros administradores e 2FA."
    onde-hoje="Passo 6. Hoje: pnpm admin:criar no server."
  />
</template>
