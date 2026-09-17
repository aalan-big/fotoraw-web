<script setup lang="ts">
import type { GaleriaPublica } from '~/types/galeria';

useSeoMeta({
  title: 'Suas fotos do evento',
  description:
    'Encontre suas fotos pelo número de peito, pague no Pix e baixe na hora. Direto do fotógrafo, sem intermediário.',
});

const api = useApi();
const busca = ref('');

const { data: recentes, status } = await useAsyncData(
  'galerias-recentes',
  () => api<GaleriaPublica[]>('/publico/galerias', { query: { limite: 8 } }),
  { default: () => [] },
);

function buscar() {
  const q = busca.value.trim();
  navigateTo({ path: '/eventos', query: q ? { q } : {} });
}

const passos = [
  {
    cor: 'amarelo' as const,
    titulo: 'Ache pelo número de peito',
    texto: 'Abra a galeria do evento e digite seu número. Só aparecem as fotos em que você está.',
  },
  {
    cor: 'azul' as const,
    titulo: 'Escolha as que quiser',
    texto: 'Veja a prévia com marca d’água, monte o carrinho e informe só nome, e-mail e WhatsApp.',
  },
  {
    cor: 'verde' as const,
    titulo: 'Pague no Pix e baixe na hora',
    texto: 'Confirmou o pagamento, a foto em alta resolução já está liberada pra download.',
  },
];
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden border-b border-borda">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(176,24,47,0.18),transparent)]"
      />
      <div class="relative mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
        <p class="mb-4 text-sm font-medium uppercase tracking-widest text-primaria-clara">
          Fotos de evento
        </p>
        <h1 class="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Encontre suas fotos e baixe na hora
        </h1>
        <p class="mx-auto mt-5 max-w-xl text-lg text-texto-2">
          Corridas, pedais, provas e festas. Busque pelo número de peito, pague no Pix e receba a
          foto em alta resolução direto do fotógrafo.
        </p>

        <form class="mx-auto mt-10 flex max-w-xl gap-2" @submit.prevent="buscar">
          <label class="sr-only" for="busca">Buscar evento ou fotógrafo</label>
          <input
            id="busca"
            v-model="busca"
            type="search"
            placeholder="Nome do evento ou do fotógrafo"
            class="h-12 flex-1 rounded-lg border border-borda-2 bg-card px-4 text-base outline-none placeholder:text-texto-3 focus:border-primaria"
          />
          <UiBotao type="submit" tamanho="lg">Buscar</UiBotao>
        </form>
        <p class="mt-3 text-sm text-texto-3">
          Recebeu um link do fotógrafo? É só abrir — ele já leva direto pra galeria.
        </p>
      </div>
    </section>

    <!-- Eventos recentes -->
    <section class="mx-auto max-w-6xl px-4 py-14">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Eventos recentes</h2>
          <p class="mt-1 text-sm text-texto-3">Galerias publicadas nos últimos dias</p>
        </div>
        <NuxtLink to="/eventos" class="text-sm text-texto-2 hover:text-texto">Ver todos</NuxtLink>
      </div>

      <div v-if="status === 'pending'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GaleriaCartaoEsqueleto v-for="i in 4" :key="i" />
      </div>
      <div v-else-if="recentes.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GaleriaCartao v-for="g in recentes" :key="g.id" :galeria="g" />
      </div>
      <div v-else class="card px-6 py-14 text-center">
        <UiPastilha cor="primaria" class="mx-auto mb-4 size-12">
          <svg
            class="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
        </UiPastilha>
        <p class="font-medium">Nenhum evento publicado ainda</p>
        <p class="mt-1 text-sm text-texto-3">
          Assim que um fotógrafo publicar uma galeria, ela aparece aqui.
        </p>
      </div>
    </section>

    <!-- Como funciona -->
    <section id="como-funciona" class="border-y border-borda bg-fundo-2">
      <div class="mx-auto max-w-6xl px-4 py-14">
        <h2 class="text-2xl font-semibold">Como funciona</h2>
        <p class="mt-1 text-sm text-texto-3">Sem cadastro, sem senha. Três passos.</p>

        <ol class="mt-8 grid gap-4 md:grid-cols-3">
          <li v-for="(p, i) in passos" :key="p.titulo" class="card p-5">
            <div class="flex items-center gap-3">
              <UiPastilha :cor="p.cor">
                <span class="text-sm font-bold">{{ i + 1 }}</span>
              </UiPastilha>
              <h3 class="font-semibold">{{ p.titulo }}</h3>
            </div>
            <p class="mt-3 text-sm leading-relaxed text-texto-2">{{ p.texto }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Para fotógrafos -->
    <section id="fotografos" class="mx-auto max-w-6xl px-4 py-14">
      <div class="card grid gap-8 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <p class="text-sm font-medium uppercase tracking-widest text-primaria-clara">
            Para fotógrafos
          </p>
          <h2 class="mt-2 text-2xl font-semibold md:text-3xl">
            Publique direto do FotoRAW desktop
          </h2>
          <p class="mt-3 max-w-xl text-texto-2">
            Você processa e marca as fotos no seu computador, como já faz. Um clique em
            <strong class="text-texto">Publicar</strong> e a galeria vai pro ar com link pra mandar
            no WhatsApp. Cobramos 10% só sobre o que vender — nada por mês.
          </p>
          <ul class="mt-5 grid gap-2 text-sm text-texto-2 sm:grid-cols-2">
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-verde" /> Pix com repasse automático
            </li>
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-verde" /> Pedidos voltam pro seu desktop
            </li>
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-verde" /> Alta resolução entregue por você
            </li>
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-verde" /> Galeria privada pra ensaios (plano
              PRO)
            </li>
          </ul>
        </div>
        <div class="flex flex-col gap-3 md:min-w-52">
          <UiBotao to="/entrar" tamanho="lg">Criar conta grátis</UiBotao>
          <UiBotao to="/entrar" variante="secundaria" tamanho="lg">Já tenho conta</UiBotao>
        </div>
      </div>
    </section>
  </div>
</template>
