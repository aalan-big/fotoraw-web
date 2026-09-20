<script setup lang="ts">
import type { MetodoPagamento, PedidoDetalhe, StatusPagamento, StatusPedido } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });

const route = useRoute();
const api = useApi();
const numero = Number(route.params.numero);

const {
  data: pedido,
  error,
  status,
} = await useAsyncData(`pedido-${numero}`, () =>
  api<PedidoDetalhe>(`/pedidos/${numero}`),
);

useSeoMeta({
  title: computed(() => (pedido.value ? `Pedido #${pedido.value.numero} · Vendas` : 'Pedido')),
});

// --- formatação -------------------------------------------------------------
function moeda(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—';
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
  AGUARDANDO_PAGAMENTO: 'Aguardando Pagamento',
  ABERTO: 'Aberto',
  CANCELADO: 'Cancelado',
  EXPIRADO: 'Expirado',
  ESTORNADO: 'Estornado',
};

const rotuloMetodo: Record<MetodoPagamento, string> = {
  PIX: 'Pix',
  CARTAO: 'Cartão de Crédito',
  BOLETO: 'Boleto Bancário',
};

// --- link whatsapp ----------------------------------------------------------
const linkWhatsApp = computed(() => {
  if (!pedido.value?.comprador?.whatsapp) return '';
  const fone = pedido.value.comprador.whatsapp.replace(/\D/g, '');
  const foneCompleto = fone.startsWith('55') ? fone : `55${fone}`;
  const texto = encodeURIComponent(
    `Olá ${pedido.value.comprador.nome}, falo sobre o seu pedido #${pedido.value.numero} no FotoRAW!`,
  );
  return `https://wa.me/${foneCompleto}?text=${texto}`;
});
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <!-- link voltar -->
    <div>
      <NuxtLink
        to="/vendas"
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
        Voltar para Vendas
      </NuxtLink>
    </div>

    <!-- erro se não encontrar -->
    <div v-if="error" class="card p-8 text-center">
      <p class="font-medium text-danger">Pedido não encontrado</p>
      <p class="mt-1 text-sm text-muted">O pedido informado não existe ou pertence a outra conta.</p>
      <UiBotao to="/vendas" class="mt-4">Ver todas as vendas</UiBotao>
    </div>

    <template v-else-if="pedido">
      <!-- cabeçalho -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight text-text">
              Pedido #{{ pedido.numero }}
            </h1>
            <UiEtiqueta :cor="corStatus[pedido.status]">
              {{ rotuloStatus[pedido.status] }}
            </UiEtiqueta>
          </div>
          <p class="mt-1 text-xs text-muted">
            Realizado em {{ dataHora(pedido.criadoEm) }}
            <span v-if="pedido.pagoEm">· Pago em {{ dataHora(pedido.pagoEm) }}</span>
            · Galeria:
            <NuxtLink
              :to="`/galerias/${pedido.galeriaId}`"
              class="font-medium text-wine-tint hover:underline"
            >
              {{ pedido.galeriaTitulo }}
            </NuxtLink>
          </p>
        </div>
      </div>

      <!-- grid de painéis superiores -->
      <div class="grid gap-4 md:grid-cols-3">
        <!-- resumo financeiro detalhado -->
        <div class="card p-5 md:col-span-2">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            Detalhamento Financeiro
          </h3>

          <dl class="mt-4 divide-y divide-border/60 text-xs">
            <div class="flex items-center justify-between py-2">
              <dt class="text-muted">Subtotal das fotos</dt>
              <dd class="font-medium text-text tabular-nums">
                {{ moeda(pedido.subtotalCentavos) }}
              </dd>
            </div>
            <div v-if="pedido.descontoCentavos > 0" class="flex items-center justify-between py-2">
              <dt class="text-muted">Desconto aplicado</dt>
              <dd class="font-medium text-danger tabular-nums">
                - {{ moeda(pedido.descontoCentavos) }}
              </dd>
            </div>
            <div v-if="pedido.taxaClienteCentavos > 0" class="flex items-center justify-between py-2">
              <dt class="text-muted">Taxa do pagamento (repassada ao comprador)</dt>
              <dd class="font-medium text-text tabular-nums">
                + {{ moeda(pedido.taxaClienteCentavos) }}
              </dd>
            </div>
            <div class="flex items-center justify-between py-2">
              <dt class="font-medium text-text">Total pago pelo cliente</dt>
              <dd class="font-bold text-text tabular-nums">
                {{ moeda(pedido.totalCentavos) }}
              </dd>
            </div>
            <div class="flex items-center justify-between py-2">
              <dt class="text-muted">Comissão FotoRAW ({{ pedido.comissaoPct }}%)</dt>
              <dd class="font-medium text-muted tabular-nums">
                - {{ moeda(pedido.comissaoCentavos) }}
              </dd>
            </div>
            <div v-if="pedido.taxaProvedorCentavos" class="flex items-center justify-between py-2">
              <dt class="text-muted">Taxa de processamento</dt>
              <dd class="font-medium text-muted tabular-nums">
                {{ moeda(pedido.taxaProvedorCentavos) }}
              </dd>
            </div>
            <div class="flex items-center justify-between pt-3">
              <dt class="text-sm font-semibold text-text">Seu Repasse Líquido</dt>
              <dd class="text-lg font-bold text-success tabular-nums">
                {{ moeda(pedido.repasseCentavos) }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- dados do comprador e suporte -->
        <div class="card flex flex-col justify-between p-5">
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
              Comprador
            </h3>

            <div class="mt-3 space-y-2 text-xs">
              <div>
                <span class="text-muted">Nome:</span>
                <p class="font-semibold text-text">{{ pedido.comprador.nome }}</p>
              </div>
              <div>
                <span class="text-muted">E-mail:</span>
                <p class="font-medium text-text break-all">{{ pedido.comprador.email }}</p>
              </div>
              <div v-if="pedido.comprador.whatsapp">
                <span class="text-muted">WhatsApp / Telefone:</span>
                <p class="font-medium text-text">{{ pedido.comprador.whatsapp }}</p>
              </div>
              <div v-if="pedido.comprador.cpf">
                <span class="text-muted">CPF:</span>
                <p class="font-mono text-text">{{ pedido.comprador.cpf }}</p>
              </div>
            </div>
          </div>

          <!-- botão suporte via whatsapp -->
          <div v-if="linkWhatsApp" class="mt-4 pt-3 border-t border-border">
            <a
              :href="linkWhatsApp"
              target="_blank"
              class="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text transition-colors hover:border-success/60 hover:text-success"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4 text-success"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Abrir WhatsApp
            </a>
          </div>
        </div>
      </div>

      <!-- fotos adquiridas no pedido -->
      <section class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-text">Fotos Compradas ({{ pedido.itens.length }})</h2>
            <p class="text-xs text-muted">Arquivos liberados para download do cliente.</p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <div
            v-for="item in pedido.itens"
            :key="item.id"
            class="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
          >
            <img
              :src="item.previewUrl"
              :alt="item.numeroIdentificacao ? `Foto #${item.numeroIdentificacao}` : 'Foto comprada'"
              class="size-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />

            <!-- número de identificação -->
            <span
              v-if="item.numeroIdentificacao"
              class="absolute left-1.5 top-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-xs"
            >
              #{{ item.numeroIdentificacao }}
            </span>

            <!-- valor pago -->
            <span
              class="absolute right-1.5 top-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs"
            >
              {{ moeda(item.precoCentavos) }}
            </span>

            <!-- status de downloads restantes -->
            <div
              v-if="item.downloadsRestantes !== undefined"
              class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 to-transparent p-2 text-center text-[10px] text-white"
            >
              {{ item.downloadsRestantes }} / {{ item.limiteDownloads }} downloads
            </div>
          </div>
        </div>
      </section>

      <!-- histórico de pagamento -->
      <section v-if="pedido.pagamentos.length > 0" class="card p-5">
        <h2 class="font-semibold text-text">Tentativas de Pagamento</h2>
        <div class="mt-3 divide-y divide-border/60 text-xs">
          <div
            v-for="pag in pedido.pagamentos"
            :key="pag.id"
            class="flex flex-wrap items-center justify-between gap-3 py-2.5"
          >
            <div>
              <p class="font-medium text-text">
                {{ rotuloMetodo[pag.metodo] ?? pag.metodo }} · {{ moeda(pag.valorCentavos) }}
              </p>
              <p class="text-[11px] text-muted">
                Criado em {{ dataHora(pag.criadoEm) }}
                <span v-if="pag.aprovadoEm">· Aprovado em {{ dataHora(pag.aprovadoEm) }}</span>
              </p>
            </div>
            <UiEtiqueta :cor="pag.status === 'APROVADO' ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'">
              {{ pag.status }}
            </UiEtiqueta>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
