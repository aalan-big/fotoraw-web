<script setup lang="ts">
import type { GaleriaPublica } from '~/types/galeria';

useSeoMeta({
  title: 'Você fez a prova. A foto é sua.',
  description:
    'Digite seu número de peito, escolha suas melhores fotos e baixe em alta resolução na hora. Pix, sem cadastro, direto do fotógrafo.',
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
    cor: 'warning' as const,
    titulo: 'Digite seu número',
    texto:
      'Abra a galeria do evento e informe o número de peito. Só aparecem as fotos em que você está — nada de rolar por milhares de desconhecidos.',
  },
  {
    cor: 'info' as const,
    titulo: 'Escolha as melhores',
    texto:
      'Veja cada foto em tamanho grande, marque as que valem a pena e finalize com nome, e-mail e WhatsApp. Só isso.',
  },
  {
    cor: 'success' as const,
    titulo: 'Pix e pronto',
    texto:
      'Pagou, baixou. A foto em alta resolução, sem marca d’água, fica liberada na hora — e o link chega no seu e-mail também.',
  },
];
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden border-b border-border">
      <!-- mesmo fundo da tela de login do desktop, escurecendo até o bg -->
      <div
        class="pointer-events-none absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center"
      />
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg"
      />
      <div class="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-40">
        <p class="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-wine-tint">
          Corridas · Pedais · Provas · Festas
        </p>
        <h1 class="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Você fez a prova.<br class="hidden md:block" />
          A foto é sua.
        </h1>
        <p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Digite seu número de peito, escolha as melhores e baixe em alta resolução na hora. Pix,
          sem cadastro, e o dinheiro vai direto pro fotógrafo que estava lá.
        </p>

        <form class="mx-auto mt-12 flex max-w-xl gap-3" @submit.prevent="buscar">
          <label class="sr-only" for="busca">Buscar evento ou fotógrafo</label>
          <input
            id="busca"
            v-model="busca"
            type="search"
            placeholder="Qual foi o evento? Ex.: Maratona de Curitiba"
            class="h-12 flex-1 rounded-lg border border-border bg-surface px-4 text-base outline-none placeholder:text-muted/70 focus:border-wine"
          />
          <UiBotao type="submit" tamanho="lg">Buscar</UiBotao>
        </form>
        <p class="mt-4 text-sm text-muted/80">
          Recebeu o link no WhatsApp? Abra direto — nem precisa buscar.
        </p>
      </div>
    </section>

    <!-- Eventos recentes -->
    <section class="mx-auto max-w-6xl px-6 py-24">
      <div class="mb-10 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Acabou de sair do forno</h2>
          <p class="mt-2 text-sm text-muted/80">
            Eventos publicados nos últimos dias — o seu pode estar aqui
          </p>
        </div>
        <NuxtLink to="/eventos" class="text-sm text-muted hover:text-text">Ver todos</NuxtLink>
      </div>

      <div v-if="status === 'pending'" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <GaleriaCartaoEsqueleto v-for="i in 4" :key="i" />
      </div>
      <div v-else-if="recentes.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <GaleriaCartao v-for="g in recentes" :key="g.id" :galeria="g" />
      </div>
      <div v-else class="card px-6 py-14 text-center">
        <UiPastilha cor="wine" class="mx-auto mb-4 size-12">
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
        <p class="font-medium">Nenhum evento no ar ainda</p>
        <p class="mt-1 text-sm text-muted/80">
          Assim que um fotógrafo publicar, aparece aqui. Se você tem o link, é só abrir.
        </p>
      </div>
    </section>

    <!-- Como funciona -->
    <section id="como-funciona" class="border-y border-border bg-surface">
      <div class="mx-auto max-w-6xl px-6 py-24">
        <h2 class="text-2xl font-semibold">Do número de peito à foto em 2 minutos</h2>
        <p class="mt-2 text-sm text-muted/80">Sem criar conta, sem senha, sem esperar e-mail.</p>

        <ol class="mt-12 grid gap-6 md:grid-cols-3">
          <li v-for="(p, i) in passos" :key="p.titulo" class="card p-7">
            <div class="flex items-center gap-3">
              <UiPastilha :cor="p.cor">
                <span class="text-sm font-bold">{{ i + 1 }}</span>
              </UiPastilha>
              <h3 class="font-semibold">{{ p.titulo }}</h3>
            </div>
            <p class="mt-4 text-sm leading-relaxed text-muted">{{ p.texto }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Para fotógrafos -->
    <section id="fotografos" class="mx-auto max-w-6xl px-6 py-24">
      <div class="card grid gap-10 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-14">
        <div>
          <p class="text-sm font-medium uppercase tracking-widest text-wine-tint">
            Para fotógrafos
          </p>
          <h2 class="mt-2 text-2xl font-semibold md:text-3xl">
            Fotografou o evento? Venda no mesmo dia.
          </h2>
          <p class="mt-4 max-w-xl leading-relaxed text-muted">
            Trate e marque as fotos no FotoRAW desktop, como já faz. Um clique em
            <strong class="text-text">Publicar</strong> e a galeria está no ar, com link pronto pro
            grupo da corrida. Sem mensalidade: você só paga 10% do que vender — se não vender, não
            paga nada.
          </p>
          <ul class="mt-7 grid gap-3 text-sm text-muted sm:grid-cols-2">
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-success" /> Pix cai direto na sua conta
            </li>
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-success" /> Cada venda aparece no seu desktop
            </li>
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-success" /> Marca d’água feita na sua máquina
            </li>
            <li class="flex items-center gap-2">
              <span class="size-1.5 rounded-full bg-success" /> Galerias privadas pra ensaios (plano
              PRO)
            </li>
          </ul>
        </div>
        <div class="flex flex-col gap-3 md:min-w-52">
          <UiBotao to="/entrar" tamanho="lg">Começar a vender</UiBotao>
          <UiBotao to="/entrar" variante="secundaria" tamanho="lg">Já tenho conta</UiBotao>
        </div>
      </div>
    </section>
  </div>
</template>
