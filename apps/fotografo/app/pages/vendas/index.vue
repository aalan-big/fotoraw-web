<script setup lang="ts">
import type {
  GaleriaResumo,
  MetricasVendas,
  MetodoPagamento,
  PedidoResumo,
  StatusPedido,
} from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Vendas' });

const api = useApi();
const { apiBase } = useRuntimeConfig().public;
const sessao = useSessao();

// --- filtros e paginação ----------------------------------------------------
const statusFiltro = ref<'TODOS' | StatusPedido>('TODOS');
const galeriaFiltro = ref('');
const periodoFiltro = ref<'30d' | '7d' | 'mes' | 'todos'>('30d');
const busca = ref('');
const buscaDebounced = ref('');
const pagina = ref(1);

let timeoutBusca: NodeJS.Timeout | null = null;
watch(busca, (val) => {
  if (timeoutBusca) clearTimeout(timeoutBusca);
  timeoutBusca = setTimeout(() => {
    buscaDebounced.value = val.trim();
    pagina.value = 1;
  }, 300);
});

watch([statusFiltro, galeriaFiltro, periodoFiltro], () => {
  pagina.value = 1;
});

function calcularDatasPeriodo(): { de?: string; ate?: string } {
  const agora = new Date();
  if (periodoFiltro.value === '7d') {
    const de = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { de: de.toISOString() };
  }
  if (periodoFiltro.value === '30d') {
    const de = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { de: de.toISOString() };
  }
  if (periodoFiltro.value === 'mes') {
    const de = new Date(agora.getFullYear(), agora.getMonth(), 1);
    return { de: de.toISOString() };
  }
  return {};
}

// --- requisições de dados ---------------------------------------------------
const { data: resposta, refresh, status } = await useAsyncData(
  'pedidos',
  () => {
    const { de, ate } = calcularDatasPeriodo();
    const query: Record<string, string | number> = {
      pagina: pagina.value,
      limite: 20,
    };
    if (statusFiltro.value !== 'TODOS') query.status = statusFiltro.value;
    if (galeriaFiltro.value) query.galeriaId = galeriaFiltro.value;
    if (de) query.de = de;
    if (ate) query.ate = ate;
    if (buscaDebounced.value) query.q = buscaDebounced.value;

    return api<{ itens: PedidoResumo[]; total: number; pagina: number; limite: number }>(
      '/pedidos',
      { query },
    );
  },
  {
    watch: [pagina, statusFiltro, galeriaFiltro, periodoFiltro, buscaDebounced],
  },
);

const { data: metricas } = await useAsyncData('pedidos-metricas', () =>
  api<MetricasVendas>('/pedidos/metricas'),
);

// lista de galerias pro filtro select
const { data: respostaGalerias } = await useAsyncData('galerias-filtro', () =>
  api<{ itens: GaleriaResumo[] }>('/galerias', { query: { limite: 100 } }),
);

const pedidos = computed(() => resposta.value?.itens ?? []);
const total = computed(() => resposta.value?.total ?? 0);
const galerias = computed(() => respostaGalerias.value?.itens ?? []);

// --- formatações ------------------------------------------------------------
function moeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dataHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const corStatus: Record<StatusPedido, string> = {
  PAGO: 'bg-success/15 text-success',
  AGUARDANDO_PAGAMENTO: 'bg-warning/15 text-warning',
  ABERTO: 'bg-surface-2 text-muted',
  CANCELADO: 'bg-surface-2 text-muted',
  EXPIRADO: 'bg-surface-2 text-muted',
  ESTORNADO: 'bg-danger/15 text-danger',
};

const rotuloStatus: Record<StatusPedido, string> = {
  PAGO: 'Pago',
  AGUARDANDO_PAGAMENTO: 'Aguardando',
  ABERTO: 'Aberto',
  CANCELADO: 'Cancelado',
  EXPIRADO: 'Expirado',
  ESTORNADO: 'Estornado',
};

const rotuloMetodo: Record<MetodoPagamento, string> = {
  PIX: 'Pix',
  CARTAO: 'Cartão',
  BOLETO: 'Boleto',
};

// --- exportação CSV ---------------------------------------------------------
const exportandoCsv = ref(false);
async function exportarCsv() {
  exportandoCsv.value = true;
  try {
    const { de, ate } = calcularDatasPeriodo();
    const params: Record<string, string> = {};
    if (statusFiltro.value !== 'TODOS') params.status = statusFiltro.value;
    if (galeriaFiltro.value) params.galeriaId = galeriaFiltro.value;
    if (de) params.de = de;
    if (ate) params.ate = ate;
    if (buscaDebounced.value) params.q = buscaDebounced.value;

    const blob = await $fetch<Blob>('/pedidos/exportar-csv', {
      baseURL: apiBase,
      headers: sessao.acesso ? { Authorization: `Bearer ${sessao.acesso}` } : undefined,
      responseType: 'blob',
      query: params,
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-fotoraw-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } finally {
    exportandoCsv.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- cabeçalho -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Vendas</h1>
        <p class="text-sm text-muted">
          Acompanhe todos os pedidos realizados na vitrine, compradores e valores a repassar.
        </p>
      </div>

      <UiBotao
        variante="secundaria"
        :disabled="exportandoCsv || total === 0"
        class="text-xs"
        @click="exportarCsv"
      >
        <svg
          viewBox="0 0 24 24"
          class="mr-1.5 size-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        {{ exportandoCsv ? 'Gerando CSV…' : 'Exportar CSV' }}
      </UiBotao>
    </div>

    <!-- indicadores de desempenho -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4">
        <p class="rotulo">Total faturado (bruto)</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-text">
          {{ moeda(metricas?.totalFaturadoCentavos ?? 0) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="rotulo">Seu repasse líquido</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-success">
          {{ moeda(metricas?.totalRepasseCentavos ?? 0) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="rotulo">Comissão retida (10%)</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-muted">
          {{ moeda(metricas?.totalComissaoCentavos ?? 0) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="rotulo">Pedidos pagos</p>
        <div class="mt-1 flex items-baseline justify-between">
          <p class="text-2xl font-semibold tabular-nums">
            {{ metricas?.totalPedidosPagos ?? 0 }}
          </p>
          <span class="text-xs text-muted">
            Médio: {{ moeda(metricas?.ticketMedioCentavos ?? 0) }}
          </span>
        </div>
      </div>
    </div>

    <!-- barra de filtros -->
    <div class="card space-y-4 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <!-- abas de status -->
        <div class="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="
              statusFiltro === 'TODOS'
                ? 'bg-wine text-white shadow-sm'
                : 'text-muted hover:text-text'
            "
            @click="statusFiltro = 'TODOS'"
          >
            Todos
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="
              statusFiltro === 'PAGO'
                ? 'bg-wine text-white shadow-sm'
                : 'text-muted hover:text-text'
            "
            @click="statusFiltro = 'PAGO'"
          >
            Pagos
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="
              statusFiltro === 'AGUARDANDO_PAGAMENTO'
                ? 'bg-wine text-white shadow-sm'
                : 'text-muted hover:text-text'
            "
            @click="statusFiltro = 'AGUARDANDO_PAGAMENTO'"
          >
            Aguardando
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="
              statusFiltro === 'CANCELADO'
                ? 'bg-wine text-white shadow-sm'
                : 'text-muted hover:text-text'
            "
            @click="statusFiltro = 'CANCELADO'"
          >
            Cancelados
          </button>
        </div>

        <!-- filtro de período -->
        <div class="flex items-center gap-1 text-xs">
          <button
            v-for="p in [
              { id: '7d', label: '7 dias' },
              { id: '30d', label: '30 dias' },
              { id: 'mes', label: 'Este mês' },
              { id: 'todos', label: 'Tudo' },
            ]"
            :key="p.id"
            type="button"
            class="rounded-md px-2.5 py-1 font-medium transition-colors"
            :class="
              periodoFiltro === p.id
                ? 'border border-wine/40 bg-wine-dim text-wine-tint'
                : 'text-muted hover:text-text'
            "
            @click="periodoFiltro = (p.id as any)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <!-- filtro por galeria -->
        <div class="w-full sm:w-64">
          <select
            v-model="galeriaFiltro"
            class="w-full rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-xs text-text focus:border-wine focus:outline-none"
          >
            <option value="">Todas as galerias</option>
            <option v-for="g in galerias" :key="g.id" :value="g.id">
              {{ g.titulo }}
            </option>
          </select>
        </div>

        <!-- campo de busca textual -->
        <div class="relative w-full sm:w-72">
          <input
            v-model="busca"
            type="text"
            placeholder="Buscar por #pedido, comprador..."
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
    </div>

    <!-- carregando -->
    <div v-if="status === 'pending'" class="card p-12 text-center text-sm text-muted">
      Carregando pedidos…
    </div>

    <!-- estado vazio -->
    <div
      v-else-if="pedidos.length === 0"
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
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </span>
      <h3 class="text-base font-semibold">Nenhuma venda encontrada</h3>
      <p class="max-w-md text-sm text-muted">
        {{
          busca || galeriaFiltro || statusFiltro !== 'TODOS'
            ? 'Nenhum pedido corresponde aos filtros aplicados.'
            : 'Quando clientes comprarem fotos nas suas galerias da vitrine, os pedidos e repasses aparecerão aqui.'
        }}
      </p>
      <NuxtLink to="/galerias" class="mt-2 text-sm font-medium text-wine-tint hover:underline">
        Ver galerias no ar →
      </NuxtLink>
    </div>

    <!-- tabela de vendas -->
    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-border bg-surface-2/60 text-muted">
            <tr>
              <th class="px-4 py-3 font-medium">Pedido</th>
              <th class="px-4 py-3 font-medium">Data</th>
              <th class="px-4 py-3 font-medium">Galeria</th>
              <th class="px-4 py-3 font-medium">Comprador</th>
              <th class="px-4 py-3 font-medium">Fotos</th>
              <th class="px-4 py-3 font-medium">Método</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium text-right">Total</th>
              <th class="px-4 py-3 font-medium text-right">Repasse Líquido</th>
              <th class="px-4 py-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            <tr
              v-for="p in pedidos"
              :key="p.id"
              class="transition-colors hover:bg-surface-2/40"
            >
              <td class="px-4 py-3.5 font-mono font-medium text-text">
                <NuxtLink :to="`/vendas/${p.numero}`" class="hover:text-wine-tint">
                  #{{ p.numero }}
                </NuxtLink>
              </td>
              <td class="px-4 py-3.5 text-muted whitespace-nowrap">
                {{ dataHora(p.pagoEm ?? p.criadoEm) }}
              </td>
              <td class="px-4 py-3.5 max-w-45 truncate text-text" :title="p.galeriaTitulo">
                {{ p.galeriaTitulo }}
              </td>
              <td class="px-4 py-3.5">
                <p class="font-medium text-text truncate max-w-40">{{ p.compradorNome }}</p>
                <p class="text-[11px] text-muted truncate max-w-40">{{ p.compradorEmail }}</p>
              </td>
              <td class="px-4 py-3.5 tabular-nums text-muted whitespace-nowrap">
                {{ p.totalItens }} {{ p.totalItens === 1 ? 'foto' : 'fotos' }}
              </td>
              <td class="px-4 py-3.5 whitespace-nowrap">
                <span v-if="p.metodoPagamento" class="text-text">
                  {{ rotuloMetodo[p.metodoPagamento] }}
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="px-4 py-3.5 whitespace-nowrap">
                <UiEtiqueta :cor="corStatus[p.status]">
                  {{ rotuloStatus[p.status] }}
                </UiEtiqueta>
              </td>
              <td class="px-4 py-3.5 text-right font-medium tabular-nums text-text whitespace-nowrap">
                {{ moeda(p.totalCentavos) }}
              </td>
              <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-success whitespace-nowrap">
                {{ moeda(p.repasseCentavos) }}
              </td>
              <td class="px-4 py-3.5 text-right whitespace-nowrap">
                <NuxtLink
                  :to="`/vendas/${p.numero}`"
                  class="text-xs font-medium text-wine-tint hover:underline"
                >
                  Detalhes →
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- paginação -->
      <div class="border-t border-border p-4">
        <UiPaginacao
          :pagina="pagina"
          :por-pagina="20"
          :total="total"
          @update:pagina="pagina = $event"
        />
      </div>
    </div>
  </div>
</template>
