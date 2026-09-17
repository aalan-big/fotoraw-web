<template>
  <footer class="mt-auto border-t border-border">
    <div
      class="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm text-muted/80 md:flex-row md:items-center"
    >
      <p>© {{ new Date().getFullYear() }} FotoRAW · fotos de evento direto do fotógrafo.</p>
      <nav class="flex gap-5">
        <NuxtLink to="/eventos" class="hover:text-muted">Eventos</NuxtLink>
        <NuxtLink to="/ensaio" class="hover:text-muted">Meu ensaio</NuxtLink>
        <NuxtLink to="/#fotografos" class="hover:text-muted">Para fotógrafos</NuxtLink>
        <NuxtLink to="/privacidade" class="hover:text-muted">Privacidade</NuxtLink>
      </nav>
    </div>
  </footer>
</template>
