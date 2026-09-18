<script setup lang="ts">
/** Pastilha de status/plano: `<UiEtiqueta :cor="corStatus[x]">Ativa</UiEtiqueta>` */
defineProps<{ cor?: string }>();
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
    :class="cor ?? 'bg-surface-2 text-muted'"
  >
    <slot />
  </span>
</template>
