<script setup lang="ts">
import type { GaleriaResumo, MetricasGalerias, Modalidade, StatusGaleria } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Galerias' });

const api = useApi();
const router = useRouter();

// --- filtros e busca --------------------------------------------------------
const statusFiltro = ref<'TODAS' | StatusGaleria>('TODAS');
const modalidadeFiltro = ref<'TODAS' | Modalidade>('TODAS');
const busca = ref('');
const buscaDebounced = ref('');

let timeoutBusca: NodeJS.Timeout | null = null;
watch(busca, (val) => {
  if (timeoutBusca) clearTimeout(timeoutBusca);
  timeoutBusca = setTimeout(() => {
    buscaDebounced.value = val.trim();
  }, 300);
});

// --- requisições à API ------------------------------------------------------
const { data: resposta, refresh, status } = await useAsyncData(
  'galerias',
  () => {
    const params: Record<string, string> = {};
    if (statusFiltro.value !== 'TODAS') params.status = statusFiltro.value;
    if (modalidadeFiltro.value !== 'TODAS') params.modalidade = modalidadeFiltro.value;
    if (buscaDebounced.value) params.q = buscaDebounced.value;

    return api<{ itens: GaleriaResumo[]; total: number }>('/galerias', {
      query: params,
    });
  },
  {
    watch: [statusFiltro, modalidadeFiltro, buscaDebounced],
  },
);

const { data: metricas, refresh: refreshMetricas } = await useAsyncData(
  'galerias-metricas',
  () => api<MetricasGalerias>('/galerias/metricas'),
);

const galerias = computed(() => resposta.value?.itens ?? []);
const total = computed(() => resposta.value?.total ?? 0);

// --- formatações ------------------------------------------------------------
function moeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dataBr(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const rotuloModalidade: Record<Modalidade, string> = {
  EVENTO: 'Evento',
  ENSAIO_INTERNO: 'Ensaio interno',
  ENSAIO_EXTERNO: 'Ensaio externo',
};

const corStatus: Record<StatusGaleria, string> = {
  PUBLICADA: 'bg-success/15 text-success',
  PAUSADA: 'bg-warning/15 text-warning',
  ENCERRADA: 'bg-surface-2 text-muted',
  RASCUNHO: 'bg-surface-2 text-muted',
};

const rotuloStatus: Record<StatusGaleria, string> = {
  PUBLICADA: 'Publicada',
  PAUSADA: 'Pausada',
  ENCERRADA: 'Encerrada',
  RASCUNHO: 'Rascunho',
};

// --- ações rápidas -----------------------------------------------------------
const galeriaModalQr = ref<GaleriaResumo | null>(null);
const linkCopiadoId = ref<string | null>(null);

async function copiarLink(g: GaleriaResumo) {
  try {
    await navigator.clipboard.writeText(g.linkPublico);
    linkCopiadoId.value = g.id;
    setTimeout(() => {
      if (linkCopiadoId.value === g.id) linkCopiadoId.value = null;
    }, 2000);
  } catch {
    /* fallback */
  }
}

const alterandoStatusId = ref<string | null>(null);
async function alternarStatus(g: GaleriaResumo) {
  const novoStatus: StatusGaleria = g.status === 'PUBLICADA' ? 'PAUSADA' : 'PUBLICADA';
  alterandoStatusId.value = g.id;
  try {
    await api(`/galerias/${g.id}/status`, {
      method: 'PATCH',
      body: { status: novoStatus },
    });
    await Promise.all([refresh(), refreshMetricas()]);
  } finally {
    alterandoStatusId.value = null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- cabeçalho -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Galerias</h1>
        <p class="text-sm text-muted">
          Suas galerias publicadas na vitrine. Publique e edite fotos pelo FotoRAW desktop.
        </p>
      </div>

      <NuxtLink
        to="/dispositivos"
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-wine hover:text-wine-tint"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        Desktop conectado
      </NuxtLink>
    </div>

    <!-- indicadores rápidos -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="card p-4">
        <p class="rotulo">Total de galerias</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ metricas?.totalGalerias ?? 0 }}
        </p>
      </div>
      <div class="card p-4">
        <p class="rotulo">Fotos publicadas</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ metricas?.totalFotos ?? 0 }}
        </p>
      </div>
      <div class="card p-4">
        <p class="rotulo">Vendas acumuladas</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-success">
          {{ moeda(metricas?.totalVendasCentavos ?? 0) }}
        </p>
      </div>
    </div>

    <!-- barra de busca e filtros -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <!-- abas de status -->
      <div class="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          :class="
            statusFiltro === 'TODAS'
              ? 'bg-wine text-white shadow-sm'
              : 'text-muted hover:text-text'
          "
          @click="statusFiltro = 'TODAS'"
        >
          Todas
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          :class="
            statusFiltro === 'PUBLICADA'
              ? 'bg-wine text-white shadow-sm'
              : 'text-muted hover:text-text'
          "
          @click="statusFiltro = 'PUBLICADA'"
        >
          Publicadas
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          :class="
            statusFiltro === 'PAUSADA'
              ? 'bg-wine text-white shadow-sm'
              : 'text-muted hover:text-text'
          "
          @click="statusFiltro = 'PAUSADA'"
        >
          Pausadas
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          :class="
            statusFiltro === 'ENCERRADA'
              ? 'bg-wine text-white shadow-sm'
              : 'text-muted hover:text-text'
          "
          @click="statusFiltro = 'ENCERRADA'"
        >
          Encerradas
        </button>
      </div>

      <!-- campo de busca -->
      <div class="relative w-full sm:w-64">
        <input
          v-model="busca"
          type="text"
          placeholder="Buscar galeria..."
          class="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-text placeholder-muted focus:border-wine focus:outline-none"
        />
        <svg
          viewBox="0 0 24 24"
          class="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
    </div>

    <!-- estado carregando -->
    <div v-if="status === 'pending'" class="card p-12 text-center text-sm text-muted">
      Carregando galerias…
    </div>

    <!-- estado vazio: nenhuma galeria no filtro ou na conta -->
    <div
      v-else-if="galerias.length === 0"
      class="card flex flex-col items-center gap-3 p-12 text-center"
    >
      <span class="pastilha size-14 text-muted">
        <svg
          viewBox="0 0 24 24"
          class="size-7"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </span>
      <h3 class="text-base font-semibold">
        {{ busca ? 'Nenhuma galeria encontrada' : 'Nenhuma galeria publicada ainda' }}
      </h3>
      <p class="max-w-md text-sm text-muted">
        {{
          busca
            ? 'Tente buscar por outro termo ou limpe os filtros.'
            : 'Abra o FotoRAW no computador, abra um ensaio ou evento e clique em "Publicar na Vitrine" para sincronizar suas fotos com a web.'
        }}
      </p>
      <NuxtLink
        v-if="!busca"
        to="/dispositivos"
        class="mt-2 text-sm font-medium text-wine-tint hover:underline"
      >
        Como conectar seu computador →
      </NuxtLink>
    </div>

    <!-- grade de galerias -->
    <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="g in galerias"
        :key="g.id"
        class="card group flex flex-col overflow-hidden transition-all duration-200 hover:border-wine/40"
      >
        <!-- capa da galeria -->
        <div class="relative aspect-video w-full overflow-hidden bg-surface-2">
          <img
            v-if="g.capaUrl"
            :src="g.capaUrl"
            :alt="g.titulo"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div
            v-else
            class="flex size-full items-center justify-center bg-linear-to-br from-surface-2 to-surface"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-8 text-muted/40"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" />
            </svg>
          </div>

          <!-- badges no topo da capa -->
          <div class="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            <UiEtiqueta :cor="corStatus[g.status]">
              {{ rotuloStatus[g.status] }}
            </UiEtiqueta>
            <UiEtiqueta cor="bg-bg/80 text-text backdrop-blur-xs">
              {{ rotuloModalidade[g.modalidade] }}
            </UiEtiqueta>
            <UiEtiqueta v-if="g.visibilidade === 'PRIVADA'" cor="bg-wine/80 text-white backdrop-blur-xs">
              Privada
            </UiEtiqueta>
          </div>
        </div>

        <!-- conteúdo do card -->
        <div class="flex flex-1 flex-col p-4">
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-base font-semibold tracking-tight text-text">
              <NuxtLink :to="`/galerias/${g.id}`" class="hover:text-wine-tint">
                {{ g.titulo }}
              </NuxtLink>
            </h3>
            <p class="mt-0.5 text-xs text-muted">
              {{ g.dataEvento ? dataBr(g.dataEvento) : `Publicada em ${dataBr(g.publicadaEm)}` }}
            </p>
          </div>

          <!-- métricas da galeria -->
          <div class="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
            <div>
              <span class="text-muted">Fotos</span>
              <p class="font-semibold tabular-nums text-text">{{ g.totalFotos }}</p>
            </div>
            <div>
              <span class="text-muted">Vendas</span>
              <p class="font-semibold tabular-nums text-success">
                {{ moeda(g.totalVendasCentavos) }}
              </p>
            </div>
          </div>

          <!-- ações rápidas do card -->
          <div class="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                title="Abrir QR Code"
                class="rounded-md border border-border p-1.5 text-muted transition-colors hover:border-wine hover:text-wine-tint"
                @click="galeriaModalQr = g"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                title="Copiar link da vitrine"
                class="rounded-md border border-border p-1.5 text-muted transition-colors hover:border-wine hover:text-wine-tint"
                @click="copiarLink(g)"
              >
                <svg
                  v-if="linkCopiadoId !== g.id"
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span v-else class="text-[11px] font-medium text-success">✓</span>
              </button>
              <button
                v-if="g.status !== 'ENCERRADA'"
                type="button"
                :title="g.status === 'PUBLICADA' ? 'Pausar vendas' : 'Retomar vendas'"
                class="rounded-md border border-border p-1.5 text-muted transition-colors hover:border-wine hover:text-wine-tint"
                :disabled="alterandoStatusId === g.id"
                @click="alternarStatus(g)"
              >
                <svg
                  v-if="g.status === 'PUBLICADA'"
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>

            <NuxtLink
              :to="`/galerias/${g.id}`"
              class="inline-flex items-center text-xs font-medium text-wine-tint hover:underline"
            >
              Ver detalhes →
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- modal de QR Code -->
    <GaleriasQrCodeModal
      v-if="galeriaModalQr"
      :aberto="!!galeriaModalQr"
      :titulo="galeriaModalQr.titulo"
      :link="galeriaModalQr.linkPublico"
      :codigo-acesso="galeriaModalQr.codigoAcesso"
      @fechar="galeriaModalQr = null"
    />
  </div>
</template>
