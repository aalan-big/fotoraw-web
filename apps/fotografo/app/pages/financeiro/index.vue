<script setup lang="ts">
import type { RepasseResumo, SaldoFotografo, StatusRepasse, MetodoRepasse } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Financeiro' });

const api = useApi();
const route = useRoute();

// --- Carregamento de dados --------------------------------------------------
const { data: saldo, refresh: refreshSaldo, status: statusSaldo } = await useAsyncData(
  'financeiro-saldo',
  () => api<SaldoFotografo>('/financeiro/saldo'),
);

const { data: repasses, refresh: refreshRepasses, status: statusRepasses } = await useAsyncData(
  'financeiro-repasses',
  () => api<RepasseResumo[]>('/financeiro/repasses'),
);

// --- Notificações de URL ----------------------------------------------------
const alertaSucesso = ref<string | null>(null);
const alertaErro = ref<string | null>(null);

if (route.query.sucesso === 'mp_conectado') {
  alertaSucesso.value = 'Sua conta do Mercado Pago foi conectada com sucesso!';
}

// --- Formulário de Taxas e Repasse ------------------------------------------
const taxasParaCliente = ref(saldo.value?.configuracao.taxasParaCliente ?? false);
const chavePix = ref(saldo.value?.configuracao.chavePix ?? '');
const cnpjCpf = ref(saldo.value?.configuracao.cnpjCpf ?? '');
const salvandoTaxas = ref(false);
const feedbackTaxas = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

// Sincroniza se os dados mudarem após refresh
watch(
  () => saldo.value?.configuracao,
  (novaConfig) => {
    if (novaConfig) {
      taxasParaCliente.value = novaConfig.taxasParaCliente;
      chavePix.value = novaConfig.chavePix ?? '';
      cnpjCpf.value = novaConfig.cnpjCpf ?? '';
    }
  },
  { deep: true },
);

async function salvarConfiguracoes() {
  salvandoTaxas.value = true;
  feedbackTaxas.value = null;

  try {
    await api('/financeiro/taxas', {
      method: 'PATCH',
      body: {
        taxasParaCliente: taxasParaCliente.value,
        chavePix: chavePix.value.trim() || null,
        cnpjCpf: cnpjCpf.value.trim() || null,
      },
    });

    await refreshSaldo();
    feedbackTaxas.value = {
      tipo: 'sucesso',
      texto: 'Configurações atualizadas com sucesso.',
    };

    setTimeout(() => {
      if (feedbackTaxas.value?.tipo === 'sucesso') {
        feedbackTaxas.value = null;
      }
    }, 4000);
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } };
    feedbackTaxas.value = {
      tipo: 'erro',
      texto: fetchErr?.data?.message ?? 'Falha ao salvar configurações. Tente novamente.',
    };
  } finally {
    salvandoTaxas.value = false;
  }
}

// --- Integração Mercado Pago ------------------------------------------------
const conectandoMp = ref(false);
const desconectandoMp = ref(false);

async function conectarMercadoPago() {
  conectandoMp.value = true;
  alertaErro.value = null;

  try {
    const res = await api<{ url: string }>('/financeiro/mercado-pago/conectar');
    if (res?.url) {
      window.location.href = res.url;
    } else {
      throw new Error('URL de autorização não retornada pelo servidor.');
    }
  } catch (err: unknown) {
    conectandoMp.value = false;
    const fetchErr = err as { data?: { message?: string } };
    alertaErro.value =
      fetchErr?.data?.message ?? 'Erro ao iniciar autorização com Mercado Pago.';
  }
}

async function desconectarMercadoPago() {
  if (
    !confirm(
      'Tem certeza de que deseja desconectar sua conta do Mercado Pago? Suas vitrines não poderão processar pagamentos com split automático até uma nova conexão.',
    )
  ) {
    return;
  }

  desconectandoMp.value = true;
  alertaErro.value = null;

  try {
    await api('/financeiro/mercado-pago', {
      method: 'DELETE',
    });

    await refreshSaldo();
    alertaSucesso.value = 'Conta do Mercado Pago desconectada com sucesso.';
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } };
    alertaErro.value =
      fetchErr?.data?.message ?? 'Erro ao desconectar conta do Mercado Pago.';
  } finally {
    desconectandoMp.value = false;
  }
}

// --- Formatações ------------------------------------------------------------
function moeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

const corStatusRepasse: Record<StatusRepasse, string> = {
  PAGO: 'bg-success/15 text-success',
  SOLICITADO: 'bg-warning/15 text-warning',
  ABERTO: 'bg-surface-2 text-muted',
  FALHOU: 'bg-danger/15 text-danger',
};

const rotuloStatusRepasse: Record<StatusRepasse, string> = {
  PAGO: 'Pago',
  SOLICITADO: 'Solicitado',
  ABERTO: 'Em aberto',
  FALHOU: 'Falhou',
};

const rotuloMetodoRepasse: Record<MetodoRepasse, string> = {
  SPLIT_AUTOMATICO: 'Split Automático',
  PIX_MANUAL: 'Transferência Pix',
};
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- Cabeçalho -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p class="text-sm text-muted">
          Gerencie seu saldo disponível para repasse, preferências fiscais e integração com Mercado Pago.
        </p>
      </div>

      <UiBotao
        variante="secundaria"
        class="text-xs"
        :disabled="statusSaldo === 'pending' || statusRepasses === 'pending'"
        @click="() => { refreshSaldo(); refreshRepasses(); }"
      >
        <svg
          viewBox="0 0 24 24"
          class="mr-1.5 size-4"
          :class="{ 'animate-spin': statusSaldo === 'pending' || statusRepasses === 'pending' }"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
        Atualizar
      </UiBotao>
    </div>

    <!-- Alertas Globais de Sucesso ou Erro -->
    <UiAlerta v-if="alertaSucesso" tipo="sucesso">
      <div class="flex items-center justify-between">
        <span>{{ alertaSucesso }}</span>
        <button
          class="ml-4 text-xs font-semibold hover:underline"
          @click="alertaSucesso = null"
        >
          Dispensar
        </button>
      </div>
    </UiAlerta>

    <UiAlerta v-if="alertaErro" tipo="erro">
      <div class="flex items-center justify-between">
        <span>{{ alertaErro }}</span>
        <button
          class="ml-4 text-xs font-semibold hover:underline"
          @click="alertaErro = null"
        >
          Dispensar
        </button>
      </div>
    </UiAlerta>

    <!-- Indicadores de Desempenho Financeiro -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4 border-l-4 border-l-success">
        <p class="rotulo">Saldo Disponível (A Receber)</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-success">
          {{ moeda(saldo?.saldoDisponivelCentavos ?? 0) }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Pronto para repasse líquido
        </p>
      </div>

      <div class="card p-4">
        <p class="rotulo">Total Já Repassado</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-text">
          {{ moeda(saldo?.saldoTotalRepassadoCentavos ?? 0) }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Transferido para sua conta
        </p>
      </div>

      <div class="card p-4">
        <p class="rotulo">Faturamento Bruto</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-text">
          {{ moeda(saldo?.totalVendasBrutoCentavos ?? 0) }}
        </p>
        <p class="mt-1 text-xs text-muted">
          {{ saldo?.totalPedidosPagos ?? 0 }} pedido{{ (saldo?.totalPedidosPagos ?? 0) === 1 ? '' : 's' }} pago{{ (saldo?.totalPedidosPagos ?? 0) === 1 ? '' : 's' }}
        </p>
      </div>

      <div class="card p-4">
        <p class="rotulo">Comissão Plataforma (10%)</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums text-muted">
          {{ moeda(saldo?.totalComissaoCentavos ?? 0) }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Retido operacional FotoRAW
        </p>
      </div>
    </div>

    <!-- Seção de Duas Colunas: Mercado Pago e Taxas -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Card Mercado Pago -->
      <UiCartao
        titulo="Conexão com Mercado Pago"
        descricao="Processamento seguro de vendas e split automático diretamente para você."
      >
        <template #acoes>
          <UiEtiqueta
            :cor="
              saldo?.conexaoMercadoPago.conectado
                ? 'bg-success/15 text-success'
                : 'bg-warning/15 text-warning'
            "
          >
            {{ saldo?.conexaoMercadoPago.conectado ? 'Conectado' : 'Desconectado' }}
          </UiEtiqueta>
        </template>

        <div v-if="saldo?.conexaoMercadoPago.conectado" class="space-y-4">
          <div class="rounded-lg border border-border bg-surface-2/40 p-4">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-lg bg-wine-dim text-wine-tint">
                <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-text">
                  {{ saldo.conexaoMercadoPago.rotulo || 'Conta Mercado Pago' }}
                </p>
                <p class="text-xs text-muted">
                  ID Provedor: {{ saldo.conexaoMercadoPago.provedorUsuarioId || '—' }}
                </p>
              </div>
            </div>
            <p class="mt-3 text-xs text-muted">
              Conectado desde: {{ dataHora(saldo.conexaoMercadoPago.conectadoEm) }}
            </p>
          </div>

          <p class="text-xs text-muted leading-relaxed">
            As compras realizadas em suas galerias via Pix ou Cartão são processadas pelo Mercado Pago e creditadas conforme as regras da sua conta do parceiro.
          </p>

          <div class="pt-2">
            <UiBotao
              variante="secundaria"
              class="w-full text-danger hover:border-danger/40"
              :disabled="desconectandoMp"
              @click="desconectarMercadoPago"
            >
              {{ desconectandoMp ? 'Desconectando…' : 'Desconectar conta do Mercado Pago' }}
            </UiBotao>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs text-warning leading-relaxed">
            <strong>Atenção:</strong> Sem a conta do Mercado Pago vinculada, suas galerias não podem aceitar pagamentos com split de receita. A conexão é rápida e autorizada diretamente pelo gateway.
          </div>

          <p class="text-xs text-muted leading-relaxed">
            Ao conectar, seus dados e tokens são armazenados com criptografia de ponta a ponta (AES-256-GCM). O FotoRAW nunca tem acesso a senhas ou dados bancários confidenciais.
          </p>

          <div class="pt-2">
            <UiBotao
              variante="primaria"
              class="w-full"
              :disabled="conectandoMp"
              @click="conectarMercadoPago"
            >
              <svg viewBox="0 0 24 24" class="mr-1.5 size-4" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              {{ conectandoMp ? 'Iniciando autorização…' : 'Conectar com Mercado Pago' }}
            </UiBotao>
          </div>
        </div>
      </UiCartao>

      <!-- Card Preferências de Taxas e Repasse -->
      <UiCartao
        titulo="Preferências de Taxas & Repasse"
        descricao="Defina o repasse de custos e preencha dados para pagamentos manuais."
      >
        <form class="space-y-4" @submit.prevent="salvarConfiguracoes">
          <!-- Toggle Taxas para Cliente -->
          <label class="flex items-start gap-3 rounded-lg border border-border bg-surface-2/30 p-3.5 cursor-pointer hover:bg-surface-2/60 transition-colors">
            <input
              v-model="taxasParaCliente"
              type="checkbox"
              class="mt-1 size-4 rounded border-border bg-bg text-wine focus:ring-wine"
            />
            <div class="text-xs">
              <span class="font-medium text-text block">Repassar taxas de pagamento ao cliente</span>
              <span class="text-muted leading-relaxed block mt-0.5">
                Se habilitado, as taxas de intermediação de cartão/pix são acrescidas ao total do pedido no carrinho. Caso desabilitado, as taxas serão deduzidas do seu repasse.
              </span>
            </div>
          </label>

          <!-- Campo Chave Pix -->
          <UiCampo
            v-model="chavePix"
            rotulo="Chave Pix para Repasses"
            placeholder="Ex: seu-email@exemplo.com ou CPF/CNPJ"
            ajuda="Utilizada caso seja necessário realizar repasse manual por Pix."
          />

          <!-- Campo CPF / CNPJ -->
          <UiCampo
            v-model="cnpjCpf"
            rotulo="CPF ou CNPJ Fiscal"
            placeholder="000.000.000-00 ou 00.000.000/0001-00"
            ajuda="Necessário para controle de faturamento e emissão de notas."
          />

          <UiAlerta v-if="feedbackTaxas" :tipo="feedbackTaxas.tipo">
            {{ feedbackTaxas.texto }}
          </UiAlerta>

          <div class="pt-2 flex justify-end">
            <UiBotao
              type="submit"
              variante="primaria"
              :disabled="salvandoTaxas"
            >
              {{ salvandoTaxas ? 'Salvando…' : 'Salvar preferências' }}
            </UiBotao>
          </div>
        </form>
      </UiCartao>
    </div>

    <!-- Extrato de Repasses -->
    <UiCartao
      titulo="Extrato de Repasses"
      descricao="Acompanhe o histórico de todas as transferências e liquidações de saldo."
    >
      <div v-if="repasses && repasses.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th scope="col" class="pb-3 pr-4 font-medium">Período</th>
              <th scope="col" class="pb-3 pr-4 font-medium">Valor Líquido</th>
              <th scope="col" class="pb-3 pr-4 font-medium">Método</th>
              <th scope="col" class="pb-3 pr-4 font-medium">Status</th>
              <th scope="col" class="pb-3 pr-4 font-medium">Data Liquidação</th>
              <th scope="col" class="pb-3 font-medium">Comprovante</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="repasse in repasses" :key="repasse.id" class="hover:bg-surface-2/40">
              <td class="py-3.5 pr-4 text-xs font-mono text-muted">
                {{ dataCurta(repasse.periodoInicio) }} até {{ dataCurta(repasse.periodoFim) }}
              </td>
              <td class="py-3.5 pr-4 font-medium tabular-nums text-text">
                {{ moeda(repasse.valorCentavos) }}
              </td>
              <td class="py-3.5 pr-4 text-xs text-muted">
                {{ rotuloMetodoRepasse[repasse.metodo] || repasse.metodo }}
              </td>
              <td class="py-3.5 pr-4">
                <UiEtiqueta :cor="corStatusRepasse[repasse.status]">
                  {{ rotuloStatusRepasse[repasse.status] || repasse.status }}
                </UiEtiqueta>
              </td>
              <td class="py-3.5 pr-4 text-xs text-muted">
                {{ dataHora(repasse.pagoEm) }}
              </td>
              <td class="py-3.5 text-xs text-muted">
                <span v-if="repasse.comprovanteKey" class="text-wine-tint hover:underline cursor-pointer">
                  Ver recibo
                </span>
                <span v-else-if="repasse.provedorTransferenciaId" class="font-mono text-[11px]">
                  #{{ repasse.provedorTransferenciaId.slice(-8) }}
                </span>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center py-12 text-center text-muted"
      >
        <div class="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted mb-3">
          <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <p class="text-sm font-medium text-text">Nenhum repasse registrado ainda</p>
        <p class="mt-1 max-w-sm text-xs text-muted">
          Assim que seus pedidos forem pagos e o valor for liquidado ou repassado para sua conta, o histórico detalhado constará nesta tabela.
        </p>
      </div>
    </UiCartao>
  </div>
</template>
