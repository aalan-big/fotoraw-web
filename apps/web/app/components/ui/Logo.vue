<script setup lang="ts">
/**
 * Logo oficial (public/imagens/logo.jpg). O arquivo tem fundo preto sólido;
 * `mix-blend-screen` faz o preto sumir sobre qualquer superfície escura.
 *
 * - completa: câmera + wordmark + tagline (hero, login)
 * - wordmark: recorte só do "FotoRaw" (cabeçalho)
 */
withDefaults(defineProps<{ variante?: 'completa' | 'wordmark' }>(), { variante: 'completa' });
</script>

<template>
  <img
    v-if="variante === 'completa'"
    src="/imagens/logo.jpg"
    alt="FotoRAW — mais do que fotos, histórias reais"
    class="mix-blend-screen"
    decoding="async"
  />
  <span v-else class="block h-9 w-40 overflow-hidden" aria-label="FotoRAW">
    <img
      src="/imagens/logo.jpg"
      alt="FotoRAW"
      class="size-full object-cover mix-blend-screen"
      style="object-position: center 62%"
      decoding="async"
    />
  </span>
</template>
