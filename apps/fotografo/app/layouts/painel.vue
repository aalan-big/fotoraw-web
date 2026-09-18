<script setup lang="ts">
const sessao = useSessao();
const menuAberto = ref(false);

// carrega /me uma vez por sessão (Início, cabeçalho e pendências usam)
if (!sessao.eu) await sessao.carregarEu().catch(() => null);
</script>

<template>
  <div class="flex min-h-dvh">
    <LayoutMenuLateral :aberto="menuAberto" @fechar="menuAberto = false" />
    <div class="flex min-w-0 flex-1 flex-col">
      <LayoutCabecalho @abrir-menu="menuAberto = true" />
      <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
</template>
