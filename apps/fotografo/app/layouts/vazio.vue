<!-- Telas de entrada: fundo com foto, sem menu. -->
<template>
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
    <div class="absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center" />
    <div class="absolute inset-0 bg-bg/55" />
    <div class="relative w-full max-w-sm">
      <NuxtLink to="/" class="mx-auto block w-fit">
        <UiLogo class="h-36" />
      </NuxtLink>
      <slot />
    </div>
  </div>
</template>
