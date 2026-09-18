<!-- Criar conta: proposta à esquerda, formulário à direita. No celular só o formulário. -->
<script setup lang="ts">
const beneficios = [
  {
    titulo: '14 dias de PRO, sem cartão',
    texto: 'Galerias privadas com seleção do cliente, 3 máquinas, 200 GB.',
  },
  {
    titulo: 'Venda fotos de evento sem mensalidade',
    texto: 'Corrida, pedal, formatura: o cliente acha, escolhe e paga por Pix ou cartão.',
  },
  {
    titulo: 'Seus originais ficam com você',
    texto: 'O desktop publica só as prévias. O dinheiro cai direto na sua conta.',
  },
];
</script>

<template>
  <div class="relative min-h-dvh overflow-hidden">
    <div class="absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center" />
    <div class="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/55" />

    <div
      class="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16 lg:px-8"
    >
      <!-- proposta (desktop) -->
      <aside class="hidden lg:block">
        <UiLogo class="h-28" />
        <h1 class="mt-8 text-4xl font-semibold leading-tight">
          Sua vitrine de fotos,<br />
          <span class="text-wine-tint">pronta pra vender.</span>
        </h1>
        <p class="mt-4 max-w-md text-lg text-muted">
          Crie a conta na web, entre com ela no FotoRAW desktop e publique a primeira galeria hoje.
        </p>

        <ul class="mt-10 space-y-5">
          <li v-for="b in beneficios" :key="b.titulo" class="flex gap-4">
            <span
              class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-wine-dim text-wine-tint"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12.5 10 17l9-10" />
              </svg>
            </span>
            <div>
              <p class="font-medium">{{ b.titulo }}</p>
              <p class="text-sm text-muted">{{ b.texto }}</p>
            </div>
          </li>
        </ul>
      </aside>

      <!-- formulário -->
      <div class="w-full max-w-md justify-self-center lg:justify-self-end">
        <NuxtLink to="/" class="mx-auto mb-6 block w-fit lg:hidden">
          <UiLogo class="h-24" />
        </NuxtLink>
        <slot />
      </div>
    </div>
  </div>
</template>
