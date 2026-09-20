<script setup lang="ts">
import type { AssinaturaDetalhe, Fatura } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const rota = useRoute();
const id = rota.params.id as string;

const {
  data: a,
  status,
  refresh,
} = await useAsyncData(`admin-assinatura-${id}`, () =>
  api<AssinaturaDetalhe>(`/admin/assinaturas/${id}`),
);
useSeoMeta({ title: () => (a.value ? `Assinatura · ${a.value.conta.nome}` : 'Assinatura') });

const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
const ocupado = ref(false);
async function agir(fn: () => Promise<unknown>, ok: string) {
  ocupado.value = true;
  msg.value = null;
  try {
    await fn();
    msg.value = { tipo: 'sucesso', texto: ok };
    await refresh();
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
  }
}

// --- marcar fatura paga ---
const pagar = reactive({ fatura: null as Fatura | null, pagaEm: '', observacao: '' });
function abrirPagar(f: Fatura) {
  const hoje = new Date();
  pagar.fatura = f;
  pagar.pagaEm = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  pagar.observacao = '';
}
function confirmarPagar() {
  const f = pagar.fatura!;
  return agir(
    () =>
      api(`/admin/faturas/${f.id}/marcar-paga`, {
        method: 'PATCH',
        body: {
          pagaEm: pagar.pagaEm ? `${pagar.pagaEm}T12:00:00` : undefined,
          observacao: pagar.observacao || undefined,
        },
      }),
    `Fatura de ${dinheiro(f.valorCentavos)} marcada como paga. Licença renovada.`,
  ).then(() => (pagar.fatura = null));
}

// --- cancelar ---
const cancelar = reactive({ aberto: false, noFimDoPeriodo: true, motivo: '' });
function confirmarCancelar() {
  return agir(
    () =>
      api(`/admin/assinaturas/${id}/cancelar`, {
        method: 'PATCH',
        body: { noFimDoPeriodo: cancelar.noFimDoPeriodo, motivo: cancelar.motivo },
      }),
    cancelar.noFimDoPeriodo
      ? 'Assinatura encerra no fim do período; nenhuma fatura nova será gerada.'
      : 'Assinatura cancelada e licença revogada — a conta caiu pro gratuito.',
  ).then(() => (cancelar.aberto = false));
}

// --- observação ---
const obs = reactive({ editando: false, texto: '' });
function salvarObs() {
  return agir(
    () =>
      api(`/admin/assinaturas/${id}/observacao`, {
        method: 'PATCH',
        body: { observacao: obs.texto },
      }),
    'Observação salva.',
  ).then(() => (obs.editando = false));
}

const encerrada = computed(() => a.value?.status === 'CANCELADA' || a.value?.status === 'EXPIRADA');
const licencaAtiva = computed(() => a.value?.licencas.find((l) => l.status === 'ATIVA') ?? null);
const provedor: Record<string, string> = {
  MANUAL: 'manual (Pix)',
  STRIPE: 'Stripe',
  MERCADOPAGO: 'Mercado Pago',
};
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5">
    <NuxtLink to="/assinaturas" class="text-sm text-muted hover:text-text">← Assinaturas</NuxtLink>
    <p v-if="status === 'pending'" class="text-sm text-muted">Carregando…</p>

    <template v-else-if="a">
      <!-- cabeçalho -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold">{{ a.conta.nome }}</h1>
            <UiEtiqueta :cor="corStatus[a.status]">{{
              rotuloStatusAssinatura[a.status]
            }}</UiEtiqueta>
            <UiEtiqueta
              v-if="a.cancelaNoFimDoPeriodo && !encerrada"
              cor="bg-warning/15 text-warning"
              >encerra em {{ dataDia(a.periodoAtualFim) }}</UiEtiqueta
            >
          </div>
          <p class="text-sm text-muted">
            <NuxtLink :to="`/fotografos/${a.conta.id}`" class="text-wine-tint hover:underline"
              >@{{ a.conta.slug }}</NuxtLink
            >
            · {{ a.conta.email }} · {{ a.plano.nome }} ·
            {{ dinheiro(a.plano.precoCentavos) }} · {{ provedor[a.provedor] }} · desde
            {{ dataDia(a.inicioEm) }}
          </p>
        </div>
        <div v-if="!encerrada" class="flex gap-2">
          <UiBotao
            variante="secundaria"
            :disabled="ocupado"
            @click="cancelar.aberto = !cancelar.aberto"
            >Cancelar assinatura</UiBotao
          >
        </div>
      </div>

      <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

      <form
        v-if="cancelar.aberto"
        class="card space-y-3 border-danger/40 p-4"
        @submit.prevent="confirmarCancelar"
      >
        <p class="text-sm font-medium">Como cancelar?</p>
        <label class="flex cursor-pointer items-start gap-2 text-sm">
          <input
            v-model="cancelar.noFimDoPeriodo"
            type="radio"
            :value="true"
            class="mt-1 accent-wine"
          />
          <span
            ><strong>No fim do período</strong> ({{ dataDia(a.periodoAtualFim) }}) — o PRO continua até
            lá, sem fatura nova. O caso normal.</span
          >
        </label>
        <label class="flex cursor-pointer items-start gap-2 text-sm">
          <input
            v-model="cancelar.noFimDoPeriodo"
            type="radio"
            :value="false"
            class="mt-1 accent-wine"
          />
          <span
            ><strong>Agora</strong> — revoga a licença na hora e a conta cai pro gratuito. Pra
            estorno ou fraude.</span
          >
        </label>
        <UiCampo v-model="cancelar.motivo" rotulo="Motivo (auditoria)" required />
        <div class="flex gap-2">
          <UiBotao type="submit" :disabled="ocupado || cancelar.motivo.trim().length < 3"
            >Confirmar</UiBotao
          >
          <UiBotao variante="fantasma" @click="cancelar.aberto = false">Voltar</UiBotao>
        </div>
      </form>

      <!-- período + licença -->
      <div class="grid gap-3 sm:grid-cols-3">
        <UiStat
          rotulo="Período atual"
          :valor="`${dataDia(a.periodoAtualInicio)} → ${dataDia(a.periodoAtualFim)}`"
        />
        <UiStat
          rotulo="Licença"
          :valor="licencaAtiva ? licencaAtiva.chave : '—'"
          :detalhe="
            licencaAtiva
              ? `ativa até ${dataDia(licencaAtiva.validaAte)}`
              : 'sem licença ativa por esta assinatura'
          "
          :alerta="!licencaAtiva && !encerrada"
        />
        <UiStat
          rotulo="Faturas"
          :valor="`${a.faturas.filter((f) => f.status === 'PAGA').length} pagas`"
          :detalhe="`${a.faturas.filter((f) => f.status === 'VENCIDA').length} vencida(s) · ${a.faturas.filter((f) => f.status === 'PENDENTE').length} pendente(s)`"
          :alerta="a.faturas.some((f) => f.status === 'VENCIDA')"
        />
      </div>

      <!-- faturas -->
      <UiTabela :vazio="!a.faturas.length ? 'Nenhuma fatura.' : undefined">
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2.5">Vencimento</th>
            <th class="px-4 py-2.5">Valor</th>
            <th class="px-4 py-2.5">Status</th>
            <th class="px-4 py-2.5">Paga em</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </template>
        <template v-for="f in a.faturas" :key="f.id">
          <tr>
            <td class="px-4 py-2.5">{{ dataDia(f.vencimento) }}</td>
            <td class="px-4 py-2.5 tabular-nums">{{ dinheiro(f.valorCentavos) }}</td>
            <td class="px-4 py-2.5">
              <UiEtiqueta :cor="corStatus[f.status]">{{ rotuloStatusFatura[f.status] }}</UiEtiqueta>
            </td>
            <td class="px-4 py-2.5 text-xs text-muted">
              {{ f.pagaEm ? dataHora(f.pagaEm) : '—' }}
            </td>
            <td class="px-4 py-2.5 text-right">
              <UiBotao
                v-if="(f.status === 'PENDENTE' || f.status === 'VENCIDA') && !encerrada"
                variante="secundaria"
                :disabled="ocupado"
                @click="pagar.fatura?.id === f.id ? (pagar.fatura = null) : abrirPagar(f)"
                >Marcar paga</UiBotao
              >
            </td>
          </tr>
          <tr v-if="pagar.fatura?.id === f.id">
            <td colspan="5" class="bg-bg/60 px-4 py-3">
              <form class="flex flex-wrap items-end gap-3" @submit.prevent="confirmarPagar">
                <UiCampo v-model="pagar.pagaEm" rotulo="Dinheiro entrou em" type="date" required />
                <div class="min-w-56 flex-1">
                  <UiCampo
                    v-model="pagar.observacao"
                    rotulo="Observação (opcional)"
                    placeholder="ex.: Pix de Fulano, comprovante no WhatsApp"
                  />
                </div>
                <UiBotao type="submit" :disabled="ocupado">Confirmar pagamento</UiBotao>
                <UiBotao variante="fantasma" @click="pagar.fatura = null">Cancelar</UiBotao>
              </form>
            </td>
          </tr>
        </template>
      </UiTabela>

      <!-- observação -->
      <UiCartao titulo="Observação do admin">
        <template #acoes>
          <button
            v-if="!obs.editando"
            type="button"
            class="text-xs text-wine-tint hover:underline"
            @click="
              obs.texto = a.observacaoAdmin ?? '';
              obs.editando = true;
            "
          >
            editar
          </button>
        </template>
        <form v-if="obs.editando" class="space-y-2" @submit.prevent="salvarObs">
          <UiCampo v-model="obs.texto" rotulo="Observação" :linhas="3" :maxlength="500" />
          <div class="flex gap-2">
            <UiBotao type="submit" :disabled="ocupado">Salvar</UiBotao>
            <UiBotao variante="fantasma" @click="obs.editando = false">Cancelar</UiBotao>
          </div>
        </form>
        <p v-else class="whitespace-pre-line text-sm" :class="{ 'text-muted': !a.observacaoAdmin }">
          {{ a.observacaoAdmin || 'Nada anotado.' }}
        </p>
      </UiCartao>

      <!-- licenças desta assinatura -->
      <UiCartao v-if="a.licencas.length" titulo="Licenças emitidas por esta assinatura">
        <ul class="divide-y divide-border text-sm">
          <li
            v-for="l in a.licencas"
            :key="l.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <span class="font-mono">{{ l.chave }}</span>
            <span class="text-xs text-muted"
              >emitida {{ data(l.emitidaEm) }} · válida até {{ dataDia(l.validaAte) }}</span
            >
            <UiEtiqueta :cor="corStatus[l.status]">{{ rotuloStatus[l.status] }}</UiEtiqueta>
          </li>
        </ul>
      </UiCartao>
    </template>
  </div>
</template>
