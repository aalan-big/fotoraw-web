<script setup lang="ts">
defineEmits<{ abrirMenu: [] }>();
const sessao = useSessao();

const licenca = computed(() => sessao.eu?.licenca ?? null);
const rotuloLicenca = computed(() => {
  const l = licenca.value;
  if (!l) return '';
  if (l.plano === 'gratuito') return 'Plano gratuito';
  if (l.plano === 'trial')
    return `Trial · ${l.diasRestantes} ${l.diasRestantes === 1 ? 'dia' : 'dias'}`;
  return l.diasRestantes === null ? 'PRO' : `PRO · vence em ${l.diasRestantes} dias`;
});
const corLicenca = computed(() => {
  const d = licenca.value?.diasRestantes;
  if (d !== null && d !== undefined && d <= 7)
    return 'border-warning/40 bg-warning/10 text-warning';
  if (licenca.value?.plano === 'gratuito') return 'border-border bg-surface-2 text-muted';
  return 'border-wine/40 bg-wine-dim text-wine-tint';
});
</script>

<template>
  <header
    class="flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6 lg:px-8"
  >
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="pastilha lg:hidden"
        aria-label="Abrir menu"
        @click="$emit('abrirMenu')"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div class="min-w-0">
        <div class="truncate font-semibold">
          {{ sessao.eu?.perfil?.nomeFantasia ?? sessao.conta?.nome }}
        </div>
        <div class="truncate text-xs text-muted">fotoraw.com.br/@{{ sessao.conta?.slug }}</div>
      </div>
    </div>
    <NuxtLink
      v-if="licenca"
      to="/plano"
      class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium"
      :class="corLicenca"
    >
      {{ rotuloLicenca }}
    </NuxtLink>
  </header>
</template>
