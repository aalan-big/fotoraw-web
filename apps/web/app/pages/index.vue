<script setup lang="ts">
import type { GaleriaPublica } from '~/types/galeria';

useSeoMeta({
  title: 'Suas fotos, direto de quem fotografou',
  description:
    'Fotos de eventos e ensaios direto do fotógrafo. Encontre o evento ou acesse seu ensaio, escolha as melhores e receba em alta resolução. Pix, sem cadastro.',
});

const api = useApi();
const busca = ref('');
const { fotografoUrl } = useRuntimeConfig().public;

const [{ data: eventos, status: statusEventos }, { data: ensaios, status: statusEnsaios }] =
  await Promise.all([
    useAsyncData(
      'vitrine-eventos',
      () => api<GaleriaPublica[]>('/publico/galerias', { query: { secao: 'eventos', limite: 6 } }),
      { default: () => [] },
    ),
    useAsyncData(
      'vitrine-ensaios',
      () => api<GaleriaPublica[]>('/publico/galerias', { query: { secao: 'ensaios', limite: 3 } }),
      { default: () => [] },
    ),
  ]);

function buscar() {
  const q = busca.value.trim();
  navigateTo({ path: '/eventos', query: q ? { q } : {} });
}

const passosEvento = [
  ['Encontre o evento', 'Busque pelo nome ou abra o link que o fotógrafo mandou.'],
  ['Ache suas fotos', 'Em provas, digite seu número e veja só as fotos em que você aparece.'],
  ['Pix e pronto', 'Pagou, baixou. Alta resolução, sem marca d’água, na hora.'],
];
const passosEnsaio = [
  ['Receba seu link', 'O fotógrafo manda um link privado, com senha, só seu.'],
  ['Escolha as favoritas', 'Marque as fotos incluídas no seu pacote e adicione extras se quiser.'],
  ['Receba em alta', 'O fotógrafo finaliza a edição e entrega as escolhidas na mesma galeria.'],
];

const diferenciais = [
  {
    cor: 'wine' as const,
    titulo: 'Seu computador é o centro',
    texto:
      'Agenda, clientes, contratos, financeiro e as fotos originais ficam na sua máquina, funcionando offline. Nada de subir 40 GB pra nuvem de terceiros.',
  },
  {
    cor: 'info' as const,
    titulo: 'Publicar é um clique',
    texto:
      'Tratou, marcou, clicou em Publicar. A galeria vai pro ar com o link pronto pro WhatsApp — a marca d’água e a alta já saem prontas do desktop.',
  },
  {
    cor: 'success' as const,
    titulo: 'Vende dos dois jeitos',
    texto:
      'Evento: foto avulsa com Pix, 10% só sobre o que vender. Ensaio: galeria privada com seleção do cliente, extras e entrega — no plano PRO.',
  },
];
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden border-b border-border">
      <div
        class="pointer-events-none absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center"
      />
      <div class="pointer-events-none absolute inset-0 bg-linear-to-b from-bg/40 via-bg/70 to-bg" />
      <div class="relative mx-auto max-w-6xl px-6 pb-20 pt-24 text-center md:pb-28 md:pt-36">
        <p class="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-wine-tint">
          Eventos · Ensaios · Formaturas · Casamentos
        </p>
        <h1 class="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Suas fotos, direto de<br class="hidden md:block" />
          quem fotografou.
        </h1>
        <p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Sem intermediário e sem cadastro. Você escolhe, paga no Pix e recebe em alta resolução — e
          o dinheiro vai pro fotógrafo que estava lá.
        </p>

        <!-- duas portas: evento x ensaio -->
        <div class="mx-auto mt-12 grid max-w-3xl gap-4 text-left md:grid-cols-2">
          <form class="card p-5 md:p-6" @submit.prevent="buscar">
            <div class="flex items-center gap-3">
              <UiPastilha cor="wine">
                <svg
                  class="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path stroke-linecap="round" d="M20 20l-3.5-3.5" />
                </svg>
              </UiPastilha>
              <div>
                <h2 class="font-semibold">Fui a um evento</h2>
                <p class="text-sm text-muted">Corrida, formatura, festa…</p>
              </div>
            </div>
            <label class="sr-only" for="busca">Buscar evento</label>
            <div class="mt-4 flex gap-2">
              <input
                id="busca"
                v-model="busca"
                type="search"
                placeholder="Nome do evento ou fotógrafo"
                class="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 outline-none placeholder:text-muted/60 focus:border-wine"
              />
              <UiBotao type="submit">Buscar</UiBotao>
            </div>
          </form>

          <NuxtLink
            to="/ensaio"
            class="card group p-5 transition-colors hover:border-wine/60 md:p-6"
          >
            <div class="flex items-center gap-3">
              <UiPastilha cor="info">
                <svg
                  class="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </UiPastilha>
              <div>
                <h2 class="font-semibold">Fiz um ensaio</h2>
                <p class="text-sm text-muted">Gestante, newborn, casamento…</p>
              </div>
            </div>
            <p class="mt-4 text-sm leading-relaxed text-muted">
              Recebeu um link ou código do fotógrafo? Acesse sua galeria privada e escolha suas
              fotos.
            </p>
            <span class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-wine-tint">
              Acessar meu ensaio
              <svg
                class="size-4 transition-transform group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Eventos recentes -->
    <section class="mx-auto max-w-6xl px-6 py-24">
      <div class="mb-10 flex items-end justify-between gap-6">
        <div>
          <span class="mb-3 block h-1 w-10 rounded-full bg-wine" aria-hidden="true" />
          <h2 class="text-2xl font-semibold md:text-3xl">Eventos recentes</h2>
          <p class="mt-2 text-muted">
            Galerias publicadas nos últimos dias. Encontre o seu evento.
          </p>
        </div>
        <UiBotao to="/eventos" variante="secundaria" class="shrink-0">Ver todos</UiBotao>
      </div>

      <div v-if="statusEventos === 'pending'" class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <GaleriaCartaoEsqueleto v-for="i in 3" :key="i" />
      </div>
      <div v-else-if="eventos.length" class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <GaleriaCartao v-for="g in eventos" :key="g.id" :galeria="g" />
      </div>
      <div v-else class="card px-6 py-16 text-center">
        <p class="font-medium">Nenhum evento no ar ainda</p>
        <p class="mt-1 text-sm text-muted/80">
          Assim que um fotógrafo publicar, aparece aqui. Se você tem o link, é só abrir.
        </p>
      </div>
    </section>

    <!-- Ensaios em destaque (portfólio) -->
    <section class="border-y border-border bg-surface">
      <div class="mx-auto max-w-6xl px-6 py-24">
        <div class="mb-10">
          <span class="mb-3 block h-1 w-10 rounded-full bg-wine" aria-hidden="true" />
          <h2 class="text-2xl font-semibold md:text-3xl">Ensaios em destaque</h2>
          <p class="mt-2 text-muted">
            Trabalhos que os fotógrafos escolheram mostrar. Gostou? Fale direto com quem fez.
          </p>
        </div>

        <div v-if="statusEnsaios === 'pending'" class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <GaleriaCartaoEsqueleto v-for="i in 3" :key="i" />
        </div>
        <div v-else-if="ensaios.length" class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <GaleriaCartao v-for="g in ensaios" :key="g.id" :galeria="g" />
        </div>
        <div v-else class="card px-6 py-16 text-center">
          <p class="font-medium">Em breve</p>
          <p class="mt-1 text-sm text-muted/80">
            Aqui vão aparecer ensaios que os clientes autorizaram os fotógrafos a mostrar.
          </p>
        </div>
      </div>
    </section>

    <!-- Como funciona: evento x ensaio -->
    <section id="como-funciona" class="mx-auto max-w-6xl px-6 py-24">
      <span class="mb-3 block h-1 w-10 rounded-full bg-wine" aria-hidden="true" />
      <h2 class="text-2xl font-semibold md:text-3xl">Como funciona</h2>
      <p class="mt-2 text-muted">Dois caminhos, o mesmo fotógrafo, a mesma galeria.</p>

      <div class="mt-12 grid gap-6 md:grid-cols-2">
        <div class="card p-7 md:p-8">
          <p class="text-xs font-semibold uppercase tracking-[0.15em] text-wine-tint">
            Fui a um evento
          </p>
          <ol class="mt-6 space-y-6">
            <li v-for="([titulo, texto], i) in passosEvento" :key="titulo" class="flex gap-4">
              <UiPastilha cor="wine" class="size-9">
                <span class="text-sm font-bold">{{ i + 1 }}</span>
              </UiPastilha>
              <div>
                <h3 class="font-semibold">{{ titulo }}</h3>
                <p class="mt-1 text-sm leading-relaxed text-muted">{{ texto }}</p>
              </div>
            </li>
          </ol>
        </div>
        <div class="card p-7 md:p-8">
          <p class="text-xs font-semibold uppercase tracking-[0.15em] text-info">Fiz um ensaio</p>
          <ol class="mt-6 space-y-6">
            <li v-for="([titulo, texto], i) in passosEnsaio" :key="titulo" class="flex gap-4">
              <UiPastilha cor="info" class="size-9">
                <span class="text-sm font-bold">{{ i + 1 }}</span>
              </UiPastilha>
              <div>
                <h3 class="font-semibold">{{ titulo }}</h3>
                <p class="mt-1 text-sm leading-relaxed text-muted">{{ texto }}</p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <!-- Em breve: app -->
    <section class="mx-auto max-w-6xl px-6 pb-24">
      <div
        class="card flex flex-col items-start gap-6 p-7 md:flex-row md:items-center md:justify-between md:p-8"
      >
        <div class="flex items-start gap-4">
          <UiPastilha cor="wine" class="size-12 shrink-0">
            <svg
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="7" y="2" width="10" height="20" rx="2" />
              <path stroke-linecap="round" d="M11 18h2" />
            </svg>
          </UiPastilha>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.15em] text-wine-tint">
              Em breve no celular
            </p>
            <h2 class="mt-1 text-xl font-semibold">App FotoRAW com proteção contra print</h2>
            <p class="mt-2 max-w-2xl leading-relaxed text-muted">
              Galeria privada que não deixa tirar print nem gravar a tela. O fotógrafo escolhe, por
              galeria, se libera pela web, só pelo app, ou pelos dois — e o cliente vê suas fotos
              com a segurança que um ensaio merece.
            </p>
          </div>
        </div>
        <span
          class="shrink-0 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-muted"
        >
          iOS e Android
        </span>
      </div>
    </section>

    <!-- Para fotógrafos: o argumento -->
    <section id="fotografos" class="border-t border-border bg-surface">
      <div class="mx-auto max-w-6xl px-6 py-24">
        <div class="max-w-2xl">
          <p class="text-sm font-medium uppercase tracking-[0.2em] text-wine-tint">
            Para fotógrafos
          </p>
          <h2 class="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            O sistema do fotógrafo, com a vitrine já embutida.
          </h2>
          <p class="mt-4 text-lg leading-relaxed text-muted">
            Todo mundo te vende uma galeria na nuvem e te cobra mensalidade pra guardar suas fotos.
            O FotoRAW faz o contrário: o sistema roda no <strong class="text-text">seu</strong>
            computador — e a internet é só a vitrine.
          </p>
        </div>

        <div class="mt-12 grid gap-6 md:grid-cols-3">
          <div v-for="d in diferenciais" :key="d.titulo" class="card p-7">
            <UiPastilha :cor="d.cor" class="size-11">
              <span class="size-2.5 rounded-full bg-current" />
            </UiPastilha>
            <h3 class="mt-5 text-lg font-semibold">{{ d.titulo }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted">{{ d.texto }}</p>
          </div>
        </div>

        <div
          class="mt-12 flex flex-col items-start justify-between gap-6 rounded-lg border border-wine/40 bg-wine-dim p-7 md:flex-row md:items-center md:p-8"
        >
          <div>
            <p class="text-lg font-semibold">
              Sem mensalidade obrigatória. Sem subir seus originais.
            </p>
            <p class="mt-1 text-muted">
              Comece de graça vendendo eventos. O plano PRO entra só quando você quiser entregar
              ensaios com seleção.
            </p>
          </div>
          <div class="flex shrink-0 gap-3">
            <UiBotao :to="`${fotografoUrl}/criar-conta`" tamanho="lg">Começar de graça</UiBotao>
            <UiBotao :to="`${fotografoUrl}/entrar`" variante="secundaria" tamanho="lg">
              Já uso o FotoRAW
            </UiBotao>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
