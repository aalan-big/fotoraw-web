<script setup lang="ts">
import type { GaleriaDetalhe, Modalidade, StatusGaleria } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });

const route = useRoute();
const router = useRouter();
const api = useApi();
const id = route.params.id as string;

const {
  data: galeria,
  refresh,
  status,
  error,
} = await useAsyncData(`galeria-${id}`, () =>
  api<GaleriaDetalhe>(`/galerias/${id}`),
);

useSeoMeta({
  title: computed(() => (galeria.value ? `${galeria.value.titulo} · Galeria` : 'Galeria')),
});

// --- formatação -------------------------------------------------------------
function moeda(centavos: number | null): string {
  if (centavos === null || centavos === undefined) return '—';
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

// --- ações da galeria -------------------------------------------------------
const modalQrAberto = ref(false);
const linkCopiado = ref(false);
const codigoCopiado = ref(false);
const alterandoStatus = ref(false);

async function copiarLink() {
  if (!galeria.value) return;
  try {
    await navigator.clipboard.writeText(galeria.value.linkPublico);
    linkCopiado.value = true;
    setTimeout(() => (linkCopiado.value = false), 2000);
  } catch {
    /* fallback */
  }
}

async function copiarCodigo() {
  if (!galeria.value?.codigoAcesso) return;
  try {
    await navigator.clipboard.writeText(galeria.value.codigoAcesso);
    codigoCopiado.value = true;
    setTimeout(() => (codigoCopiado.value = false), 2000);
  } catch {
    /* fallback */
  }
}

async function alternarPausa() {
  if (!galeria.value) return;
  const novoStatus: StatusGaleria =
    galeria.value.status === 'PUBLICADA' ? 'PAUSADA' : 'PUBLICADA';
  alterandoStatus.value = true;
  try {
    await api(`/galerias/${id}/status`, {
      method: 'PATCH',
      body: { status: novoStatus },
    });
    await refresh();
  } finally {
    alterandoStatus.value = false;
  }
}

async function encerrarGaleria() {
  if (!confirm('Deseja encerrar esta galeria? Ela não estará mais acessível para compra na vitrine.')) {
    return;
  }
  alterandoStatus.value = true;
  try {
    await api(`/galerias/${id}/status`, {
      method: 'PATCH',
      body: { status: 'ENCERRADA' },
    });
    await refresh();
  } finally {
    alterandoStatus.value = false;
  }
}

// --- filtro de fotos por número de peito ------------------------------------
const buscaFoto = ref('');
const fotosFiltradas = computed(() => {
  if (!galeria.value?.fotos) return [];
  if (!buscaFoto.value.trim()) return galeria.value.fotos;
  const termo = buscaFoto.value.trim().toLowerCase();
  return galeria.value.fotos.filter(
    (f) =>
      f.numeroIdentificacao?.toLowerCase().includes(termo) ||
      f.fotoIdDesktop.toLowerCase().includes(termo),
  );
});
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- link voltar -->
    <div>
      <NuxtLink
        to="/galerias"
        class="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-text"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Voltar para Galerias
      </NuxtLink>
    </div>

    <!-- erro se não encontrar -->
    <div v-if="error" class="card p-8 text-center">
      <p class="font-medium text-danger">Galeria não encontrada</p>
      <p class="mt-1 text-sm text-muted">A galeria solicitada não existe ou foi excluída.</p>
      <UiBotao to="/galerias" class="mt-4">Ver minhas galerias</UiBotao>
    </div>

    <template v-else-if="galeria">
      <!-- cabeçalho da galeria -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-bold tracking-tight text-text">
              {{ galeria.titulo }}
            </h1>
            <UiEtiqueta :cor="corStatus[galeria.status]">
              {{ rotuloStatus[galeria.status] }}
            </UiEtiqueta>
            <UiEtiqueta cor="bg-surface-2 text-muted">
              {{ rotuloModalidade[galeria.modalidade] }}
            </UiEtiqueta>
            <UiEtiqueta v-if="galeria.visibilidade === 'PRIVADA'" cor="bg-wine/80 text-white">
              Galeria Privada
            </UiEtiqueta>
          </div>
          <p class="mt-1 text-xs text-muted">
            {{ galeria.dataEvento ? `Evento em ${dataBr(galeria.dataEvento)}` : '' }}
            <span v-if="galeria.cidade">· {{ galeria.cidade }}<template v-if="galeria.uf">/{{ galeria.uf }}</template></span>
            <span>· Publicada em {{ dataBr(galeria.publicadaEm) }}</span>
          </p>
        </div>

        <!-- ações de topo -->
        <div class="flex flex-wrap items-center gap-2">
          <a
            :href="galeria.linkPublico"
            target="_blank"
            class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-wine hover:text-wine-tint"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Ver na vitrine
          </a>

          <UiBotao
            v-if="galeria.status !== 'ENCERRADA'"
            variante="secundaria"
            :disabled="alterandoStatus"
            @click="alternarPausa"
          >
            {{ galeria.status === 'PUBLICADA' ? 'Pausar vendas' : 'Retomar vendas' }}
          </UiBotao>

          <button
            v-if="galeria.status !== 'ENCERRADA'"
            type="button"
            class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-danger hover:text-danger"
            :disabled="alterandoStatus"
            @click="encerrarGaleria"
          >
            Encerrar
          </button>
        </div>
      </div>

      <!-- cartões de detalhe -->
      <div class="grid gap-4 sm:grid-cols-3">
        <!-- divulgação -->
        <div class="card flex flex-col justify-between p-5">
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
              Divulgação & Acesso
            </h3>

            <!-- código de acesso se privada -->
            <div v-if="galeria.codigoAcesso" class="mt-3 rounded-lg bg-surface-2 p-2.5">
              <span class="text-[11px] text-muted">Código de acesso:</span>
              <div class="mt-0.5 flex items-center justify-between">
                <span class="font-mono text-base font-bold tracking-wider text-text">
                  {{ galeria.codigoAcesso }}
                </span>
                <button
                  type="button"
                  class="text-xs text-wine-tint hover:underline"
                  @click="copiarCodigo"
                >
                  {{ codigoCopiado ? 'Copiado!' : 'Copiar' }}
                </button>
              </div>
            </div>

            <!-- link direto -->
            <div class="mt-3">
              <span class="text-[11px] text-muted">Link público:</span>
              <div class="mt-1 flex items-center gap-1.5">
                <span class="truncate text-xs font-medium text-wine-tint">
                  {{ galeria.linkPublico }}
                </span>
                <button
                  type="button"
                  class="shrink-0 text-xs text-muted hover:text-text"
                  @click="copiarLink"
                >
                  {{ linkCopiado ? 'Copiado!' : 'Copiar' }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3">
            <UiBotao
              variante="secundaria"
              class="w-full text-xs"
              @click="modalQrAberto = true"
            >
              <svg
                viewBox="0 0 24 24"
                class="mr-1.5 size-4"
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
              Abrir QR Code
            </UiBotao>
          </div>
        </div>

        <!-- configuração de venda -->
        <div class="card p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            Configuração de Venda
          </h3>

          <dl class="mt-3 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <dt class="text-muted">Modo de venda</dt>
              <dd class="font-medium text-text capitalize">{{ galeria.modoVenda.toLowerCase() }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted">Preço por foto</dt>
              <dd class="font-medium text-text">{{ moeda(galeria.precoFotoCentavos) }}</dd>
            </div>
            <div v-if="galeria.fotosIncluidas" class="flex items-center justify-between">
              <dt class="text-muted">Fotos incluídas</dt>
              <dd class="font-medium text-text">{{ galeria.fotosIncluidas }} fotos</dd>
            </div>
            <div v-if="galeria.precoPacoteCentavos" class="flex items-center justify-between">
              <dt class="text-muted">Preço do pacote</dt>
              <dd class="font-medium text-text">{{ moeda(galeria.precoPacoteCentavos) }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted">Download grátis</dt>
              <dd class="font-medium text-text">
                {{ galeria.permiteDownloadGratis ? 'Sim' : 'Não' }}
              </dd>
            </div>
          </dl>

          <p class="mt-4 text-[11px] text-muted">
            Preços e modos de venda são definidos no FotoRAW Desktop antes de publicar.
          </p>
        </div>

        <!-- métricas e vendas -->
        <div class="card p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            Resultados na Vitrine
          </h3>

          <dl class="mt-3 space-y-3">
            <div>
              <dt class="text-xs text-muted">Total de fotos</dt>
              <dd class="text-2xl font-bold tabular-nums text-text">{{ galeria.totalFotos }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Faturamento acumulado</dt>
              <dd class="text-2xl font-bold tabular-nums text-success">
                {{ moeda(galeria.totalVendasCentavos) }}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- fotos publicadas -->
      <section class="card p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold text-text">Fotos publicadas ({{ galeria.fotos.length }})</h2>
            <p class="text-xs text-muted">
              Pré-visualizações com marca d'água enviadas do desktop.
            </p>
          </div>

          <!-- busca por número de peito/identificação -->
          <div class="relative w-full sm:w-60">
            <input
              v-model="buscaFoto"
              type="text"
              placeholder="Filtrar por nº de peito..."
              class="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-xs text-text placeholder-muted focus:border-wine focus:outline-none"
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

        <!-- grid de fotos -->
        <div
          v-if="fotosFiltradas.length > 0"
          class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          <div
            v-for="foto in fotosFiltradas"
            :key="foto.id"
            class="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
          >
            <img
              :src="foto.previewUrl"
              :alt="foto.numeroIdentificacao ? `Foto #${foto.numeroIdentificacao}` : 'Foto da galeria'"
              class="size-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />

            <!-- badge do número de identificação -->
            <span
              v-if="foto.numeroIdentificacao"
              class="absolute left-1.5 top-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-xs"
            >
              #{{ foto.numeroIdentificacao }}
            </span>

            <!-- badge de preço específico se houver -->
            <span
              v-if="foto.precoCentavos"
              class="absolute right-1.5 top-1.5 rounded bg-success/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs"
            >
              {{ moeda(foto.precoCentavos) }}
            </span>
          </div>
        </div>

        <div v-else class="p-8 text-center text-sm text-muted">
          Nenhuma foto encontrada com o número pesquisado.
        </div>
      </section>

      <!-- modal de QR Code -->
      <GaleriasQrCodeModal
        v-if="modalQrAberto"
        :aberto="modalQrAberto"
        :titulo="galeria.titulo"
        :link="galeria.linkPublico"
        :codigo-acesso="galeria.codigoAcesso"
        @fechar="modalQrAberto = false"
      />
    </template>
  </div>
</template>
