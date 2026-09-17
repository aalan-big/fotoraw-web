<template>
  <footer class="mt-auto border-t border-borda">
    <div
      class="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-texto-3 md:flex-row md:items-center"
    >
      <p>© {{ new Date().getFullYear() }} FotoRAW · fotos de evento direto do fotógrafo.</p>
      <nav class="flex gap-5">
        <NuxtLink to="/eventos" class="hover:text-texto-2">Eventos</NuxtLink>
        <NuxtLink to="/#fotografos" class="hover:text-texto-2">Para fotógrafos</NuxtLink>
        <NuxtLink to="/privacidade" class="hover:text-texto-2">Privacidade</NuxtLink>
      </nav>
    </div>
  </footer>
</template>
