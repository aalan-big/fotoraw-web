<script setup lang="ts">
// Atendimento: achar um pedido pelo número (vem no e-mail do comprador) e, se
// preciso, devolver — estorno total no Mercado Pago do fotógrafo. Motivo
// obrigatório (vai pra auditoria).
definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Pedidos' });

interface PedidoAdmin {
  id: string;
  numero: number;
  status: 'ABERTO' | 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'CANCELADO' | 'EXPIRADO' | 'ESTORNADO';
  criadoEm: string;
  pagoEm: string | null;
  fotos: number;
  subtotalCentavos: number;
  totalCentavos: number;
  comissaoCentavos: number;
  taxaProvedorCentavos: number | null;
  repasseCentavos: number;
  comprador: { nome: string; email: string; whatsapp: string | null };
  galeria: { titulo: string; slug: string };
  fotografo: { nome: string; slug: string };
  pagamentos: { metodo: string; status: string; valorCentavos: number; provedorPagamentoId: string; aprovadoEm: string | null; criadoEm: string }[];
}

const api = useApi();
const rota = useRoute();
const busca = ref(String(rota.query.numero ?? ''));
const pedido = ref<PedidoAdmin | null>(null);
const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
const ocupado = ref(false);
const motivo = ref('');
const confirmando = ref(false);

const dinheiro = (c: number | null) =>
  c == null ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const corStatus: Record<PedidoAdmin['status'], string> = {
  PAGO: 'bg-success/15 text-success',
  AGUARDANDO_PAGAMENTO: 'bg-warning/15 text-warning',
  ABERTO: 'bg-surface-2 text-muted',
  CANCELADO: 'bg-surface-2 text-muted',
  EXPIRADO: 'bg-surface-2 text-muted',
  ESTORNADO: 'bg-danger/15 text-danger',
};

async function buscar() {
  const n = Number(busca.value.replace(/\D/g, ''));
  msg.value = null;
  pedido.value = null;
  confirmando.value = false;
  if (!n) return;
  ocupado.value = true;
  try {
    pedido.value = await api<PedidoAdmin>(`/admin/pedidos/${n}`);
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
  }
}
onMounted(() => busca.value && buscar());

async function devolver() {
  if (!pedido.value) return;
  ocupado.value = true;
  msg.value = null;
  try {
    await api(`/admin/pedidos/${pedido.value.numero}/devolver`, { method: 'POST', body: { motivo: motivo.value } });
    msg.value = { tipo: 'sucesso', texto: `Pedido #${pedido.value.numero} devolvido. Comprador e fotógrafo foram avisados.` };
    motivo.value = '';
    confirmando.value = false;
    pedido.value = await api<PedidoAdmin>(`/admin/pedidos/${pedido.value.numero}`);
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <NuxtLink to="/financeiro" class="text-xs text-muted hover:text-text">← Financeiro</NuxtLink>
      <h1 class="mt-1 text-2xl font-bold tracking-tight">Pedidos</h1>
      <p class="text-sm text-muted">Ache um pedido pelo número (está no e-mail do comprador) e devolva se precisar.</p>
    </div>

    <form class="flex gap-2" @submit.prevent="buscar">
      <input
        v-model="busca"
        inputmode="numeric"
        placeholder="Número do pedido, ex.: 1042"
        class="h-11 w-64 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-wine"
      />
      <UiBotao type="submit" :disabled="ocupado">Buscar</UiBotao>
    </form>

    <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

    <template v-if="pedido">
      <UiCartao>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-bold">Pedido #{{ pedido.numero }}</h2>
              <UiEtiqueta :cor="corStatus[pedido.status]">{{ pedido.status }}</UiEtiqueta>
            </div>
            <p class="mt-1 text-xs text-muted">
              Criado {{ dataHora(pedido.criadoEm) }}<template v-if="pedido.pagoEm"> · pago {{ dataHora(pedido.pagoEm) }}</template>
            </p>
          </div>
          <p class="text-2xl font-bold tabular-nums">{{ dinheiro(pedido.totalCentavos) }}</p>
        </div>

        <dl class="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt class="text-xs text-muted">Galeria</dt><dd>{{ pedido.galeria.titulo }} · {{ pedido.fotos }} {{ pedido.fotos === 1 ? 'foto' : 'fotos' }}</dd></div>
          <div><dt class="text-xs text-muted">Fotógrafo</dt><dd>{{ pedido.fotografo.nome }} <span class="text-muted">@{{ pedido.fotografo.slug }}</span></dd></div>
          <div><dt class="text-xs text-muted">Comprador</dt><dd>{{ pedido.comprador.nome }} · {{ pedido.comprador.email }}</dd></div>
          <div><dt class="text-xs text-muted">WhatsApp</dt><dd>{{ pedido.comprador.whatsapp ?? '—' }}</dd></div>
          <div><dt class="text-xs text-muted">Comissão FotoRAW</dt><dd class="tabular-nums">{{ dinheiro(pedido.comissaoCentavos) }}</dd></div>
          <div><dt class="text-xs text-muted">Taxa MP · fotógrafo recebe</dt><dd class="tabular-nums">{{ dinheiro(pedido.taxaProvedorCentavos) }} · {{ dinheiro(pedido.repasseCentavos) }}</dd></div>
        </dl>

        <div v-if="pedido.pagamentos.length" class="mt-5 border-t border-border pt-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">Pagamentos</p>
          <ul class="mt-2 space-y-1 text-xs">
            <li v-for="pg in pedido.pagamentos" :key="pg.provedorPagamentoId" class="flex flex-wrap justify-between gap-2">
              <span>{{ pg.metodo }} · {{ dinheiro(pg.valorCentavos) }} · MP #{{ pg.provedorPagamentoId }}</span>
              <span class="text-muted">{{ pg.status }} · {{ dataHora(pg.aprovadoEm ?? pg.criadoEm) }}</span>
            </li>
          </ul>
        </div>
      </UiCartao>

      <UiCartao v-if="pedido.status === 'PAGO'" titulo="Devolver ao comprador" descricao="Estorno total pelo Mercado Pago (sai da conta do fotógrafo; a comissão volta junto). Os downloads param.">
        <form class="space-y-3" @submit.prevent="confirmando ? devolver() : (confirmando = true)">
          <input
            v-model="motivo"
            required
            minlength="3"
            maxlength="300"
            placeholder="Motivo (obrigatório): ex.: comprador pediu, foto de outra pessoa…"
            class="h-11 w-full rounded-lg border border-border bg-bg px-4 text-sm outline-none focus:border-wine"
          />
          <p v-if="confirmando" class="text-sm text-warning">
            Confirma? {{ dinheiro(pedido.totalCentavos) }} voltam para {{ pedido.comprador.nome }}. Não dá pra desfazer.
          </p>
          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="ocupado || motivo.trim().length < 3"
              class="inline-flex h-10 items-center rounded-lg bg-danger px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {{ confirmando ? (ocupado ? 'Devolvendo…' : 'Sim, devolver') : 'Devolver' }}
            </button>
            <UiBotao v-if="confirmando" variante="fantasma" @click="confirmando = false">Cancelar</UiBotao>
          </div>
        </form>
      </UiCartao>
    </template>
  </div>
</template>
