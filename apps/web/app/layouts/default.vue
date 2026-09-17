<template>
  <div class="flex min-h-dvh flex-col">
    <LayoutCabecalho />
    <main class="flex-1">
      <slot />
    </main>
    <LayoutRodape />
  </div>
</template>
