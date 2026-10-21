<script setup lang="ts">
// Instalador do desktop. O .exe fica no R2 (fotos.fotoraw.com.br/app/…), não na VPS:
// são ~40 MB por download e a VPS é compartilhada. Nova versão = subir o arquivo no
// bucket e trocar NUXT_PUBLIC_INSTALADOR_URL / NUXT_PUBLIC_INSTALADOR_VERSAO.
useSeoMeta({
  title: 'Baixar o FotoRAW',
  description: 'Baixe o FotoRAW para Windows: organize, selecione e publique suas fotos direto do seu computador.',
});
const { instaladorUrl, instaladorVersao, fotografoUrl } = useRuntimeConfig().public;

const passos = [
  {
    titulo: 'Baixe o instalador',
    texto: 'Clique no botão acima. O arquivo tem cerca de 40 MB.',
  },
  {
    titulo: 'Abra o arquivo baixado',
    texto:
      'Se aparecer “O Windows protegeu o computador”, clique em “Mais informações” e depois em “Executar assim mesmo”. O aviso aparece porque o programa é novo — ele é seguro.',
  },
  {
    titulo: 'Entre com a sua conta',
    texto: 'Use o mesmo e-mail e senha do painel do fotógrafo. Ainda não tem conta? Crie de graça.',
  },
];
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-16">
    <p class="text-sm font-medium uppercase tracking-[0.2em] text-wine-tint">Para fotógrafos</p>
    <h1 class="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Baixe o FotoRAW</h1>
    <p class="mt-4 text-lg leading-relaxed text-muted">
      O sistema roda no seu computador: você organiza, seleciona e publica as fotos na vitrine sem
      subir os originais para a nuvem.
    </p>

    <div class="card mt-10 flex flex-col items-start gap-5 p-7 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-lg font-semibold">FotoRAW para Windows</p>
        <p class="mt-1 text-sm text-muted">Versão {{ instaladorVersao }} · Windows 10 ou 11 (64 bits)</p>
      </div>
      <UiBotao :to="instaladorUrl" tamanho="lg" class="shrink-0">
        <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />
        </svg>
        Baixar para Windows
      </UiBotao>
    </div>
    <p class="mt-3 text-sm text-muted">Versão para Mac em breve.</p>

    <h2 class="mt-14 text-lg font-semibold">Como instalar</h2>
    <ol class="mt-4 space-y-5">
      <li v-for="(p, i) in passos" :key="p.titulo" class="flex gap-4">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-wine-dim text-sm font-semibold text-wine-tint"
        >
          {{ i + 1 }}
        </span>
        <div>
          <p class="font-medium">{{ p.titulo }}</p>
          <p class="mt-1 leading-relaxed text-muted">{{ p.texto }}</p>
        </div>
      </li>
    </ol>

    <div class="mt-10 flex flex-wrap gap-3">
      <UiBotao :to="`${fotografoUrl}/criar-conta`" variante="secundaria">Criar conta grátis</UiBotao>
      <UiBotao to="/planos" variante="fantasma">Ver planos</UiBotao>
    </div>
  </div>
</template>
