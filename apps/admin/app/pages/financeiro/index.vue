<script setup lang="ts">
import type { FinanceiroResumo } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Financeiro' });

const api = useApi();
const rota = useRoute();
const router = useRouter();

// --- período ------------------------------------------------------------------
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoje = new Date();
const atalhos = [
  {
    rotulo: 'Este mês',
    de: () => new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    ate: () => hoje,
  },
  {
    rotulo: 'Mês passado',
    de: () => new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
    ate: () => new Date(hoje.getFullYear(), hoje.getMonth(), 0),
  },
  { rotulo: '7 dias', de: () => new Date(hoje.getTime() - 6 * 864e5), ate: () => hoje },
  { rotulo: '30 dias', de: () => new Date(hoje.getTime() - 29 * 864e5), ate: () => hoje },
  { rotulo: 'Este ano', de: () => new Date(hoje.getFullYear(), 0, 1), ate: () => hoje },
];
const periodo = reactive({
  de: typeof rota.query.de === 'string' ? rota.query.de : iso(atalhos[0]!.de()),
  ate: typeof rota.query.ate === 'string' ? rota.query.ate : iso(atalhos[0]!.ate()),
});
const atalhoAtivo = computed(
  () => atalhos.find((a) => iso(a.de()) === periodo.de && iso(a.ate()) === periodo.ate)?.rotulo,
);
function aplicarAtalho(a: (typeof atalhos)[number]) {
  periodo.de = iso(a.de());
  periodo.ate = iso(a.ate());
}

const { data: r, status } = await useAsyncData(
  'admin-financeiro',
  () =>
    api<FinanceiroResumo>('/admin/financeiro/resumo', {
      query: { de: periodo.de, ate: periodo.ate },
    }),
  { watch: [() => periodo.de, () => periodo.ate] },
);
watch(
  () => [periodo.de, periodo.ate],
  () => router.replace({ query: { de: periodo.de, ate: periodo.ate } }),
);

// --- gráfico por dia (uma série: total vendido) ---------------------------------
const LARGURA = 720;
const ALTURA = 160;
const MARGEM = { topo: 18, base: 22, esq: 8, dir: 8 };
const barras = computed(() => {
  const dias = r.value?.porDia ?? [];
  if (!dias.length) return [];
  const max = Math.max(...dias.map((d) => d.totalCentavos));
  const util = LARGURA - MARGEM.esq - MARGEM.dir;
  const passo = util / dias.length;
  const largura = Math.max(4, Math.min(28, passo - 2)); // 2px de respiro entre barras
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base;
  return dias.map((d, i) => {
    const h = max ? Math.max(2, (d.totalCentavos / max) * alturaUtil) : 0;
    return {
      ...d,
      x: MARGEM.esq + i * passo + (passo - largura) / 2,
      y: ALTURA - MARGEM.base - h,
      w: largura,
      h,
      maior: d.totalCentavos === max,
      rotulo: dataDia(d.dia).slice(0, 5),
    };
  });
});
const rotulosEixo = computed(() => {
  const b = barras.value;
  if (b.length <= 8) return b;
  const cada = Math.ceil(b.length / 8);
  return b.filter((_, i) => i % cada === 0 || i === b.length - 1);
});
const foco = ref<number | null>(null);
const mostrarTabela = ref(false);
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Financeiro</h1>
        <p class="text-sm text-muted">
          Vendas de foto, comissão da plataforma e o que falta repassar aos fotógrafos.
        </p>
      </div>
      <UiBotao to="/financeiro/repasses" variante="secundaria">
        Repasses<template v-if="r?.aRepassar.totalCentavos">
          · {{ dinheiro(r.aRepassar.totalCentavos) }} em aberto</template
        >
      </UiBotao>
    </div>

    <!-- período -->
    <div class="card flex flex-wrap items-end gap-3 p-4">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="a in atalhos"
          :key="a.rotulo"
          type="button"
          class="rounded-md border px-2.5 py-1 text-xs"
          :class="
            atalhoAtivo === a.rotulo
              ? 'border-wine bg-wine-dim text-wine-tint'
              : 'border-border text-muted hover:border-wine hover:text-wine-tint'
          "
          @click="aplicarAtalho(a)"
        >
          {{ a.rotulo }}
        </button>
      </div>
      <div class="ml-auto flex items-end gap-2">
        <label>
          <span class="rotulo">De</span>
          <input v-model="periodo.de" type="date" class="campo w-40" :max="periodo.ate" />
        </label>
        <label>
          <span class="rotulo">Até</span>
          <input v-model="periodo.ate" type="date" class="campo w-40" :min="periodo.de" />
        </label>
      </div>
    </div>

    <template v-if="r">
      <!-- números do período -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UiStat
          rotulo="Vendido no período"
          :valor="dinheiro(r.vendas.totalCentavos)"
          :detalhe="`${r.vendas.pedidos} pedido(s) pago(s)${r.vendas.estornos ? ` · ${r.vendas.estornos} estorno(s)` : ''}`"
        />
        <UiStat
          rotulo="Comissão da plataforma"
          :valor="dinheiro(r.vendas.comissaoCentavos)"
          :detalhe="`taxas do provedor ${dinheiro(r.vendas.taxasCentavos)}`"
        />
        <UiStat
          rotulo="Assinaturas recebidas"
          :valor="dinheiro(r.assinaturas.recebidoCentavos)"
          :detalhe="`${r.assinaturas.faturasPagas} fatura(s) paga(s)`"
        />
        <UiStat
          rotulo="A repassar (total)"
          :valor="dinheiro(r.aRepassar.totalCentavos)"
          :detalhe="`${r.aRepassar.contas} fotógrafo(s)${r.aRepassar.repassesAbertos ? ` · ${r.aRepassar.repassesAbertos} repasse(s) aberto(s)` : ''}`"
          :alerta="r.aRepassar.totalCentavos > 0"
          to="/financeiro/repasses"
        />
      </div>

      <!-- vendas por dia -->
      <UiCartao
        titulo="Vendas por dia"
        :descricao="`${dataDia(r.periodo.de)} a ${dataDia(r.periodo.ate)}`"
      >
        <template #acoes>
          <button
            type="button"
            class="text-xs text-wine-tint hover:underline"
            @click="mostrarTabela = !mostrarTabela"
          >
            {{ mostrarTabela ? 'ver gráfico' : 'ver tabela' }}
          </button>
        </template>
        <p v-if="!barras.length" class="py-6 text-center text-sm text-muted">
          Nenhuma venda paga no período.
        </p>
        <UiTabela v-else-if="mostrarTabela">
          <template #cabecalho>
            <tr>
              <th class="px-4 py-2">Dia</th>
              <th class="px-4 py-2 text-right">Pedidos</th>
              <th class="px-4 py-2 text-right">Vendido</th>
              <th class="px-4 py-2 text-right">Comissão</th>
            </tr>
          </template>
          <tr v-for="d in r.porDia" :key="d.dia">
            <td class="px-4 py-2">{{ dataDia(d.dia) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ d.pedidos }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ dinheiro(d.totalCentavos) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ dinheiro(d.comissaoCentavos) }}</td>
          </tr>
        </UiTabela>
        <div v-else class="relative" :aria-label="`Vendas por dia, ${barras.length} dias`">
          <svg :viewBox="`0 0 ${LARGURA} ${ALTURA}`" class="h-44 w-full" role="img">
            <line
              :x1="MARGEM.esq"
              :x2="LARGURA - MARGEM.dir"
              :y1="ALTURA - MARGEM.base"
              :y2="ALTURA - MARGEM.base"
              class="stroke-border"
              stroke-width="1"
            />
            <g v-for="(b, i) in barras" :key="b.dia">
              <!-- alvo de hover maior que a barra -->
              <rect
                :x="b.x - 4"
                :y="MARGEM.topo"
                :width="b.w + 8"
                :height="ALTURA - MARGEM.topo - MARGEM.base"
                fill="transparent"
                @mouseenter="foco = i"
                @mouseleave="foco = null"
              />
              <path
                :d="
                  b.h < 8
                    ? `M${b.x},${ALTURA - MARGEM.base} v${-b.h} h${b.w} v${b.h} z`
                    : `M${b.x},${ALTURA - MARGEM.base} v${-(b.h - 4)} q0,-4 4,-4 h${b.w - 8} q4,0 4,4 v${b.h - 4} z`
                "
                class="fill-wine transition-opacity"
                :class="foco !== null && foco !== i ? 'opacity-40' : ''"
              />
              <text
                v-if="b.maior || foco === i"
                :x="b.x + b.w / 2"
                :y="b.y - 5"
                text-anchor="middle"
                class="fill-text text-[10px] font-medium tabular-nums"
              >
                {{ dinheiro(b.totalCentavos) }}
              </text>
            </g>
            <text
              v-for="b in rotulosEixo"
              :key="`r-${b.dia}`"
              :x="b.x + b.w / 2"
              :y="ALTURA - 6"
              text-anchor="middle"
              class="fill-muted text-[10px]"
            >
              {{ b.rotulo }}
            </text>
          </svg>
          <div
            v-if="foco !== null && barras[foco]"
            class="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          >
            <strong>{{ dataDia(barras[foco]!.dia) }}</strong> ·
            {{ barras[foco]!.pedidos }} pedido(s) · {{ dinheiro(barras[foco]!.totalCentavos) }} ·
            comissão {{ dinheiro(barras[foco]!.comissaoCentavos) }}
          </div>
        </div>
      </UiCartao>

      <!-- por fotógrafo -->
      <UiCartao titulo="Por fotógrafo" descricao="Quem mais vendeu no período.">
        <UiTabela :vazio="!r.porConta.length ? 'Nenhuma venda no período.' : undefined">
          <template #cabecalho>
            <tr>
              <th class="px-4 py-2">Fotógrafo</th>
              <th class="px-4 py-2 text-right">Pedidos</th>
              <th class="px-4 py-2 text-right">Vendido</th>
              <th class="px-4 py-2 text-right">Comissão</th>
              <th class="px-4 py-2 text-right">Do fotógrafo</th>
            </tr>
          </template>
          <tr v-for="c in r.porConta" :key="c.conta.id" class="hover:bg-surface-2/60">
            <td class="px-4 py-2">
              <NuxtLink
                :to="`/fotografos/${c.conta.id}`"
                class="font-medium hover:text-wine-tint"
                >{{ c.conta.nome }}</NuxtLink
              >
              <span class="ml-1 text-xs text-muted">@{{ c.conta.slug }}</span>
            </td>
            <td class="px-4 py-2 text-right tabular-nums">{{ c.pedidos }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ dinheiro(c.totalCentavos) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ dinheiro(c.comissaoCentavos) }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ dinheiro(c.repasseCentavos) }}</td>
          </tr>
        </UiTabela>
      </UiCartao>
    </template>
    <p v-else-if="status === 'pending'" class="text-sm text-muted">Carregando…</p>
  </div>
</template>
