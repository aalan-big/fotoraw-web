<script setup lang="ts">
import type { AssinaturasPaginado } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Assinaturas' });

const api = useApi();
const rota = useRoute();
const router = useRouter();
const q = (k: string) => (typeof rota.query[k] === 'string' ? (rota.query[k] as string) : '');

const filtro = reactive({
  q: q('q'),
  status: q('status'),
  vencidas: q('vencidas') === '1',
  pagina: Number(rota.query.pagina ?? 1) || 1,
});

const {
  data: lista,
  status,
  refresh,
} = await useAsyncData(
  'admin-assinaturas',
  () =>
    api<AssinaturasPaginado>('/admin/assinaturas', {
      query: {
        q: filtro.q || undefined,
        status: filtro.status || undefined,
        vencidas: filtro.vencidas ? 'true' : undefined,
        pagina: filtro.pagina,
        porPagina: 25,
      },
    }),
  { watch: [() => filtro.status, () => filtro.vencidas, () => filtro.pagina] },
);
watch(
  () => [filtro.q, filtro.status, filtro.vencidas, filtro.pagina],
  () =>
    router.replace({
      query: {
        ...(filtro.q && { q: filtro.q }),
        ...(filtro.status && { status: filtro.status }),
        ...(filtro.vencidas && { vencidas: '1' }),
        ...(filtro.pagina > 1 && { pagina: filtro.pagina }),
      },
    }),
);
function buscar() {
  filtro.pagina = 1;
  refresh();
}
const periodo: Record<string, string> = { MENSAL: '/mês', ANUAL: '/ano', NENHUMA: '' };
const provedor: Record<string, string> = {
  MANUAL: 'manual (Pix)',
  STRIPE: 'Stripe',
  MERCADOPAGO: 'Mercado Pago',
};
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Assinaturas</h1>
        <p class="text-sm text-muted">
          Cobrança do plano PRO. Manuais (Pix) por aqui; a Stripe entra nas mesmas tabelas.
        </p>
      </div>
      <UiBotao to="/assinaturas/nova">Nova assinatura manual</UiBotao>
    </div>

    <div v-if="lista" class="grid gap-3 sm:grid-cols-3">
      <UiStat rotulo="Ativas" :valor="lista.numeros.ativas" />
      <UiStat
        rotulo="MRR"
        :valor="dinheiro(lista.numeros.mrrCentavos)"
        detalhe="receita mensal recorrente (anual ÷ 12)"
      />
      <UiStat
        rotulo="Faturas vencidas"
        :valor="lista.numeros.faturasVencidas"
        :alerta="lista.numeros.faturasVencidas > 0"
        detalhe="aguardando pagamento fora do prazo"
      />
    </div>

    <form class="card flex flex-wrap items-end gap-3 p-4" @submit.prevent="buscar">
      <label class="min-w-56 flex-1">
        <span class="rotulo">Fotógrafo</span>
        <input v-model="filtro.q" class="campo" placeholder="nome, e-mail ou @slug" />
      </label>
      <label>
        <span class="rotulo">Status</span>
        <select v-model="filtro.status" class="campo w-44" @change="filtro.pagina = 1">
          <option value="">todos</option>
          <option value="ATIVA">Ativa</option>
          <option value="INADIMPLENTE">Inadimplente</option>
          <option value="CANCELADA">Cancelada</option>
          <option value="TRIAL">Trial</option>
          <option value="EXPIRADA">Expirada</option>
        </select>
      </label>
      <label class="flex h-10 cursor-pointer items-center gap-2 text-sm">
        <input
          v-model="filtro.vencidas"
          type="checkbox"
          class="size-4 accent-wine"
          @change="filtro.pagina = 1"
        />
        só com fatura vencida
      </label>
      <UiBotao type="submit">Buscar</UiBotao>
    </form>

    <UiTabela
      :carregando="status === 'pending'"
      :vazio="lista && !lista.itens.length ? 'Nenhuma assinatura com esses filtros.' : undefined"
    >
      <template #cabecalho>
        <tr>
          <th class="px-4 py-2.5">Fotógrafo</th>
          <th class="px-4 py-2.5">Plano</th>
          <th class="px-4 py-2.5">Status</th>
          <th class="px-4 py-2.5">Período atual</th>
          <th class="px-4 py-2.5">Próxima fatura</th>
          <th class="px-4 py-2.5">Origem</th>
        </tr>
      </template>
      <tr
        v-for="a in lista?.itens"
        :key="a.id"
        class="cursor-pointer hover:bg-surface-2/60"
        @click="navigateTo(`/assinaturas/${a.id}`)"
      >
        <td class="px-4 py-2.5">
          <span class="block font-medium">{{ a.conta.nome }}</span>
          <span class="block text-xs text-muted">@{{ a.conta.slug }} · {{ a.conta.email }}</span>
        </td>
        <td class="px-4 py-2.5">
          <span class="block">{{ a.plano.nome }}</span>
          <span class="block text-xs text-muted"
            >{{ dinheiro(a.plano.precoCentavos) }}{{ periodo[a.plano.periodicidade] }}</span
          >
        </td>
        <td class="px-4 py-2.5">
          <UiEtiqueta :cor="corStatus[a.status]">{{ rotuloStatusAssinatura[a.status] }}</UiEtiqueta>
          <span
            v-if="a.cancelaNoFimDoPeriodo && a.status === 'ATIVA'"
            class="ml-1 text-xs text-muted"
            >encerra no fim</span
          >
        </td>
        <td class="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
          {{ dataDia(a.periodoAtualInicio) }} → {{ dataDia(a.periodoAtualFim) }}
        </td>
        <td class="px-4 py-2.5 text-xs whitespace-nowrap">
          <template v-if="a.proximaFatura">
            <span :class="a.proximaFatura.status === 'VENCIDA' ? 'text-danger' : ''"
              >{{ dinheiro(a.proximaFatura.valorCentavos) }} ·
              {{ dataDia(a.proximaFatura.vencimento) }}</span
            >
            <span v-if="a.proximaFatura.status === 'VENCIDA'" class="ml-1 text-danger"
              >vencida</span
            >
          </template>
          <span v-else class="text-muted">—</span>
        </td>
        <td class="px-4 py-2.5 text-xs text-muted">{{ provedor[a.provedor] }}</td>
      </tr>
    </UiTabela>

    <UiPaginacao
      v-if="lista"
      v-model:pagina="filtro.pagina"
      :por-pagina="lista.porPagina"
      :total="lista.total"
    />
  </div>
</template>
