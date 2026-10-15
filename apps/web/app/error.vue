<script setup lang="ts">
import type { NuxtError } from '#app';

// Página de erro do site (404, galeria fora do ar, erro do server) — no lugar
// do "Page not found" padrão do Nuxt.
const props = defineProps<{ error: NuxtError }>();

const naoEncontrada = computed(() => props.error.statusCode === 404);
useSeoMeta({ title: naoEncontrada.value ? 'Página não encontrada' : 'Algo deu errado', robots: 'noindex' });

const voltar = () => clearError({ redirect: '/' });
</script>

<template>
  <NuxtLayout>
    <div class="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p class="text-7xl font-bold tracking-tight text-wine-tint">{{ error.statusCode }}</p>
      <h1 class="mt-4 text-2xl font-semibold">
        {{ naoEncontrada ? 'Não achamos essa página' : 'Algo deu errado por aqui' }}
      </h1>
      <p class="mt-2 text-muted">
        <template v-if="naoEncontrada">
          O link pode estar errado, ou a galeria saiu do ar. Se recebeu o link de um fotógrafo, confira com ele.
        </template>
        <template v-else>Tente de novo em alguns instantes.</template>
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <UiBotao @click="voltar">Ir pro início</UiBotao>
        <UiBotao variante="secundaria" to="/eventos">Ver eventos</UiBotao>
      </div>
    </div>
  </NuxtLayout>
</template>
