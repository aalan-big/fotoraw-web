<script setup lang="ts">
import type { Paginado, Repasse, SaldoConta } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Repasses' });

const api = useApi();

const { data: saldos, refresh: recarregarSaldos } = await useAsyncData('admin-saldos', () =>
  api<SaldoConta[]>('/admin/financeiro/saldos'),
);
const filtroStatus = ref<'' | 'ABERTO' | 'PAGO' | 'FALHOU'>('');
const { data: fila, refresh: recarregarFila } = await useAsyncData(
  'admin-repasses',
  () =>
    api<Paginado<Repasse>>('/admin/repasses', {
      query: { status: filtroStatus.value || undefined, porPagina: 50 },
    }),
  { watch: [filtroStatus] },
);
const recarregar = () => Promise.all([recarregarSaldos(), recarregarFila()]);

const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
const ocupado = ref(false);
async function agir(fn: () => Promise<unknown>, ok: string) {
  ocupado.value = true;
  msg.value = null;
  try {
    await fn();
    msg.value = { tipo: 'sucesso', texto: ok };
    await recarregar();
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
  }
}

// --- gerar --------------------------------------------------------------------
const gerar = reactive({ conta: null as SaldoConta | null, valor: '' });
function abrirGerar(s: SaldoConta) {
  gerar.conta = s;
  gerar.valor = (s.saldoCentavos / 100).toFixed(2).replace('.', ',');
}
function confirmarGerar() {
  const s = gerar.conta!;
  const centavos = Math.round(Number(gerar.valor.replace(/\./g, '').replace(',', '.')) * 100);
  return agir(
    () =>
      api('/admin/repasses', {
        method: 'POST',
        body: {
          contaId: s.conta.id,
          valorCentavos: centavos === s.saldoCentavos ? undefined : centavos,
        },
      }),
    `Repasse de ${dinheiro(centavos)} gerado pra ${s.conta.nome}. Faça o Pix e marque como pago.`,
  ).then(() => (gerar.conta = null));
}

// --- pagar / falhou --------------------------------------------------------------
const pagar = reactive({ repasse: null as Repasse | null, pagoEm: '', referencia: '' });
function abrirPagar(r: Repasse) {
  const hoje = new Date();
  pagar.repasse = r;
  pagar.pagoEm = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  pagar.referencia = '';
}
function confirmarPagar() {
  const r = pagar.repasse!;
  return agir(
    () =>
      api(`/admin/repasses/${r.id}/pagar`, {
        method: 'PATCH',
        body: { pagoEm: `${pagar.pagoEm}T12:00:00`, referencia: pagar.referencia || undefined },
      }),
    `Repasse de ${dinheiro(r.valorCentavos)} pra ${r.conta.nome} marcado como pago.`,
  ).then(() => (pagar.repasse = null));
}
function falhou(r: Repasse) {
  const motivo = prompt(`Por que o Pix pra ${r.conta.nome} não saiu? (vai pra auditoria)`);
  if (!motivo || motivo.trim().length < 3) return;
  return agir(
    () => api(`/admin/repasses/${r.id}/falhou`, { method: 'PATCH', body: { motivo } }),
    'Repasse marcado como falho — o valor voltou pro saldo em aberto.',
  );
}
async function copiar(texto: string) {
  await navigator.clipboard.writeText(texto).catch(() => null);
}

const comSaldo = computed(
  () => saldos.value?.filter((s) => s.saldoCentavos > 0 || s.repassesAbertos > 0) ?? [],
);
const semSaldo = computed(
  () => saldos.value?.filter((s) => s.saldoCentavos <= 0 && s.repassesAbertos === 0) ?? [],
);
const totalAberto = computed(() =>
  comSaldo.value.reduce((t, s) => t + Math.max(0, s.saldoCentavos), 0),
);
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <NuxtLink to="/financeiro" class="text-sm text-muted hover:text-text">← Financeiro</NuxtLink>
    <div>
      <h1 class="text-2xl font-semibold">Repasses</h1>
      <p class="text-sm text-muted">
        O que cada fotógrafo tem a receber das vendas (já descontada a comissão e as taxas). Gere o
        repasse, faça o Pix na chave dele e marque como pago.
      </p>
    </div>

    <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

    <!-- saldos -->
    <UiCartao
      titulo="Saldos em aberto"
      :descricao="
        comSaldo.length
          ? `${comSaldo.length} fotógrafo(s) · ${dinheiro(totalAberto)} a repassar`
          : 'Ninguém com saldo a receber.'
      "
    >
      <UiTabela v-if="comSaldo.length">
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2">Fotógrafo</th>
            <th class="px-4 py-2">Chave Pix</th>
            <th class="px-4 py-2 text-right">Vendido</th>
            <th class="px-4 py-2 text-right">Já repassado</th>
            <th class="px-4 py-2 text-right">Saldo</th>
            <th class="px-4 py-2"></th>
          </tr>
        </template>
        <template v-for="s in comSaldo" :key="s.conta.id">
          <tr class="hover:bg-surface-2/60">
            <td class="px-4 py-2.5">
              <NuxtLink
                :to="`/fotografos/${s.conta.id}`"
                class="font-medium hover:text-wine-tint"
                >{{ s.conta.nome }}</NuxtLink
              >
              <span class="block text-xs text-muted">
                @{{ s.conta.slug }} · {{ s.pedidosPagos }} venda(s) · última
                {{ data(s.ultimaVendaEm) }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-xs">
              <template v-if="s.chavePix">
                <span class="font-mono">{{ s.chavePix }}</span>
                <button
                  type="button"
                  class="ml-1 text-wine-tint hover:underline"
                  @click="copiar(s.chavePix!)"
                >
                  copiar
                </button>
              </template>
              <span v-else class="text-warning">sem chave Pix no perfil</span>
            </td>
            <td class="px-4 py-2.5 text-right tabular-nums">{{ dinheiro(s.vendidoCentavos) }}</td>
            <td class="px-4 py-2.5 text-right tabular-nums text-muted">
              {{ dinheiro(s.repassadoCentavos) }}
            </td>
            <td class="px-4 py-2.5 text-right font-semibold tabular-nums">
              {{ dinheiro(s.saldoCentavos) }}
            </td>
            <td class="px-4 py-2.5 text-right">
              <span v-if="s.repassesAbertos" class="text-xs text-warning"
                >repasse aberto na fila</span
              >
              <UiBotao
                v-else-if="s.saldoCentavos > 0"
                variante="secundaria"
                :disabled="ocupado"
                @click="gerar.conta?.conta.id === s.conta.id ? (gerar.conta = null) : abrirGerar(s)"
                >Gerar repasse</UiBotao
              >
            </td>
          </tr>
          <tr v-if="gerar.conta?.conta.id === s.conta.id">
            <td colspan="6" class="bg-bg/60 px-4 py-3">
              <form class="flex flex-wrap items-end gap-3" @submit.prevent="confirmarGerar">
                <UiCampo
                  v-model="gerar.valor"
                  rotulo="Valor (R$)"
                  inputmode="decimal"
                  :ajuda="`saldo ${dinheiro(s.saldoCentavos)} — pode ser parcial`"
                />
                <UiBotao type="submit" :disabled="ocupado">Gerar</UiBotao>
                <UiBotao variante="fantasma" @click="gerar.conta = null">Cancelar</UiBotao>
              </form>
            </td>
          </tr>
        </template>
      </UiTabela>
      <p v-if="semSaldo.length" class="mt-3 text-xs text-muted">
        Em dia: {{ semSaldo.map((s) => s.conta.nome).join(', ') }}.
      </p>
    </UiCartao>

    <!-- fila -->
    <UiCartao titulo="Fila de repasses">
      <template #acoes>
        <select v-model="filtroStatus" class="campo h-8 w-36 py-0 text-xs">
          <option value="">todos</option>
          <option value="ABERTO">abertos</option>
          <option value="PAGO">pagos</option>
          <option value="FALHOU">falhos</option>
        </select>
      </template>
      <UiTabela :vazio="fila && !fila.itens.length ? 'Nenhum repasse.' : undefined">
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2">Fotógrafo</th>
            <th class="px-4 py-2">Período</th>
            <th class="px-4 py-2 text-right">Valor</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Pago em</th>
            <th class="px-4 py-2"></th>
          </tr>
        </template>
        <template v-for="r in fila?.itens" :key="r.id">
          <tr class="hover:bg-surface-2/60">
            <td class="px-4 py-2.5">
              <span class="font-medium">{{ r.conta.nome }}</span>
              <span class="block font-mono text-xs text-muted">{{
                r.chavePix ?? 'sem chave Pix'
              }}</span>
            </td>
            <td class="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
              {{ dataDia(r.periodoInicio) }} → {{ dataDia(r.periodoFim) }}
            </td>
            <td class="px-4 py-2.5 text-right font-semibold tabular-nums">
              {{ dinheiro(r.valorCentavos) }}
            </td>
            <td class="px-4 py-2.5">
              <UiEtiqueta :cor="corStatus[r.status]">{{
                rotuloStatusRepasse[r.status]
              }}</UiEtiqueta>
            </td>
            <td class="px-4 py-2.5 text-xs text-muted">
              {{ r.pagoEm ? dataHora(r.pagoEm) : '—' }}
              <span v-if="r.provedorTransferenciaId" class="block font-mono">{{
                r.provedorTransferenciaId
              }}</span>
            </td>
            <td class="px-4 py-2.5 text-right whitespace-nowrap">
              <template v-if="r.status === 'ABERTO' || r.status === 'SOLICITADO'">
                <UiBotao
                  :disabled="ocupado"
                  @click="pagar.repasse?.id === r.id ? (pagar.repasse = null) : abrirPagar(r)"
                  >Marcar pago</UiBotao
                >
                <button
                  type="button"
                  class="ml-2 text-xs text-danger hover:underline"
                  :disabled="ocupado"
                  @click="falhou(r)"
                >
                  falhou
                </button>
              </template>
            </td>
          </tr>
          <tr v-if="pagar.repasse?.id === r.id">
            <td colspan="6" class="bg-bg/60 px-4 py-3">
              <form class="flex flex-wrap items-end gap-3" @submit.prevent="confirmarPagar">
                <UiCampo v-model="pagar.pagoEm" rotulo="Pix feito em" type="date" required />
                <div class="min-w-56 flex-1">
                  <UiCampo
                    v-model="pagar.referencia"
                    rotulo="Referência (opcional)"
                    placeholder="ID da transação / E2E do Pix"
                  />
                </div>
                <UiBotao type="submit" :disabled="ocupado">Confirmar</UiBotao>
                <UiBotao variante="fantasma" @click="pagar.repasse = null">Cancelar</UiBotao>
              </form>
            </td>
          </tr>
        </template>
      </UiTabela>
    </UiCartao>
  </div>
</template>
