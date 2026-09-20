<script setup lang="ts">
import type {
  FaturaResumo,
  Licenca,
  PlanoCatalogo,
  StatusAssinaturaFotografo,
  StatusFaturaFotografo,
  StatusPlanoFotografo,
} from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Plano & Assinatura' });

const api = useApi();
const sessao = useSessao();

// --- Carregamento de dados --------------------------------------------------
const { data: statusPlano, refresh: refreshStatus, status: statusRequisicao } = await useAsyncData(
  'plano-status',
  () => api<StatusPlanoFotografo>('/planos/meu-status'),
);

const licenca = computed<Licenca | null>(() => statusPlano.value?.licenca ?? sessao.eu?.licenca ?? null);
const assinatura = computed(() => statusPlano.value?.assinatura ?? null);
const faturas = computed<FaturaResumo[]>(() => statusPlano.value?.faturas ?? []);
const planos = computed<PlanoCatalogo[]>(() => statusPlano.value?.planosDisponiveis ?? []);

const planoMensal = computed(() => planos.value.find((p) => p.codigo === 'pro_mensal'));
const planoAnual = computed(() => planos.value.find((p) => p.codigo === 'pro_anual'));

// --- Estados de ação e notificações -----------------------------------------
const copiadoChave = ref(false);
const assinandoCodigo = ref<string | null>(null);
const cancelando = ref(false);
const reativando = ref(false);
const modalCancelarAberto = ref(false);
const motivoCancelamento = ref('');
const alertaSucesso = ref<string | null>(null);
const alertaErro = ref<string | null>(null);

// --- Cópia da chave de licença ----------------------------------------------
async function copiarChave() {
  const chave = licenca.value?.chave;
  if (!chave) return;
  try {
    await navigator.clipboard.writeText(chave);
    copiadoChave.value = true;
    setTimeout(() => {
      copiadoChave.value = false;
    }, 2000);
  } catch {
    // Fallback silencioso caso clipboard não esteja disponível
  }
}

// --- Contratação / Upgrade de Plano -----------------------------------------
async function assinarPlano(codigo: 'pro_mensal' | 'pro_anual') {
  assinandoCodigo.value = codigo;
  alertaErro.value = null;
  alertaSucesso.value = null;

  try {
    const atualizado = await api<StatusPlanoFotografo>('/planos/assinar', {
      method: 'POST',
      body: { planoCodigo: codigo },
    });

    statusPlano.value = atualizado;
    await sessao.carregarEu();

    const nomePlano = codigo === 'pro_anual' ? 'PRO Anual' : 'PRO Mensal';
    alertaSucesso.value = `Parabéns! Sua assinatura do plano ${nomePlano} foi confirmada com sucesso.`;
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } };
    alertaErro.value =
      fetchErr?.data?.message ?? 'Não foi possível concluir a assinatura. Tente novamente.';
  } finally {
    assinandoCodigo.value = null;
  }
}

// --- Cancelamento no Fim do Período -----------------------------------------
async function confirmarCancelamento() {
  cancelando.value = true;
  alertaErro.value = null;

  try {
    const atualizado = await api<StatusPlanoFotografo>('/planos/cancelar', {
      method: 'POST',
      body: { motivo: motivoCancelamento.value.trim() || undefined },
    });

    statusPlano.value = atualizado;
    await sessao.carregarEu();
    modalCancelarAberto.value = false;
    motivoCancelamento.value = '';
    alertaSucesso.value =
      'Cancelamento agendado. Você continuará com acesso a todos os recursos PRO até o término do período vigente.';
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } };
    alertaErro.value =
      fetchErr?.data?.message ?? 'Erro ao agendar cancelamento da assinatura.';
  } finally {
    cancelando.value = false;
  }
}

// --- Reativação de Assinatura -----------------------------------------------
async function reativarAssinatura() {
  reativando.value = true;
  alertaErro.value = null;

  try {
    const atualizado = await api<StatusPlanoFotografo>('/planos/reativar', {
      method: 'POST',
    });

    statusPlano.value = atualizado;
    await sessao.carregarEu();
    alertaSucesso.value = 'Sua assinatura foi reativada com sucesso! A renovação automática continuará normalmente.';
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } };
    alertaErro.value =
      fetchErr?.data?.message ?? 'Erro ao reativar assinatura.';
  } finally {
    reativando.value = false;
  }
}

// --- Formatações ------------------------------------------------------------
function moeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const semLimite = 'Ilimitado';
const num = (n: number | null | undefined) => (n === null || n === undefined ? semLimite : n.toLocaleString('pt-BR'));
const gb = (mb: number | null | undefined) =>
  mb === null || mb === undefined ? semLimite : mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;

const trialPct = computed(() => {
  const l = licenca.value;
  if (!l?.validaAte || l.diasRestantes === null) return null;
  const total = 14;
  return Math.max(5, Math.min(100, Math.round((l.diasRestantes / total) * 100)));
});

const corStatusFatura: Record<StatusFaturaFotografo, string> = {
  PAGA: 'bg-success/15 text-success',
  PENDENTE: 'bg-warning/15 text-warning',
  VENCIDA: 'bg-danger/15 text-danger',
  CANCELADA: 'bg-surface-2 text-muted',
  ESTORNADA: 'bg-danger/15 text-danger',
};

const rotuloStatusFatura: Record<StatusFaturaFotografo, string> = {
  PAGA: 'Paga',
  PENDENTE: 'Pendente',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
  ESTORNADA: 'Estornada',
};

const recursosLicenca = computed(() => {
  const r = licenca.value?.recursos;
  if (!r) return [];
  return [
    { rotulo: 'Vender fotos de evento (10% de taxa)', ok: r.permite_evento },
    { rotulo: 'Publicar ensaios (portfólio e entrega direta)', ok: r.permite_ensaio },
    { rotulo: 'Galeria privada com seleção pelo cliente', ok: r.permite_galeria_privada },
    { rotulo: 'Gestão de estúdio no desktop (clientes, agenda, contratos)', ok: r.permite_gestao_estudio },
  ];
});
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- Cabeçalho -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Plano & Assinatura</h1>
        <p class="text-sm text-muted">
          Gerencie seu plano atual, chave de ativação do FotoRAW Desktop, limites de uso e cobranças.
        </p>
      </div>

      <UiBotao
        variante="secundaria"
        class="text-xs"
        :disabled="statusRequisicao === 'pending'"
        @click="refreshStatus"
      >
        <svg
          viewBox="0 0 24 24"
          class="mr-1.5 size-4"
          :class="{ 'animate-spin': statusRequisicao === 'pending' }"
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

    <!-- Alertas Globais -->
    <UiAlerta v-if="alertaSucesso" tipo="sucesso">
      <div class="flex items-center justify-between">
        <span>{{ alertaSucesso }}</span>
        <button class="ml-4 text-xs font-semibold hover:underline" @click="alertaSucesso = null">
          Dispensar
        </button>
      </div>
    </UiAlerta>

    <UiAlerta v-if="alertaErro" tipo="erro">
      <div class="flex items-center justify-between">
        <span>{{ alertaErro }}</span>
        <button class="ml-4 text-xs font-semibold hover:underline" @click="alertaErro = null">
          Dispensar
        </button>
      </div>
    </UiAlerta>

    <!-- Banner de Status do Plano Atual -->
    <!-- 1. Estado TRIAL -->
    <section
      v-if="licenca?.plano === 'trial'"
      class="relative overflow-hidden rounded-xl border border-wine/40 bg-linear-to-br from-wine-dim via-surface to-surface p-6 sm:p-7"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="rounded-full bg-wine/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-wine-tint border border-wine/40">
              Período de Testes (Trial)
            </span>
            <span class="text-xs text-muted">
              Válido até {{ dataCurta(licenca?.validaAte) }}
            </span>
          </div>
          <h2 class="mt-3 text-xl font-semibold text-text">
            Você está aproveitando todos os recursos do FotoRAW PRO!
          </h2>
          <p class="mt-1 max-w-2xl text-sm text-muted">
            Restam <strong class="text-text">{{ licenca?.diasRestantes }} {{ licenca?.diasRestantes === 1 ? 'dia' : 'dias' }}</strong> de teste gratuito. Assine o plano PRO a qualquer momento para garantir a continuidade de seus ensaios, seleções de clientes e sincronização sem bloqueios.
          </p>
        </div>

        <UiBotao
          variante="primaria"
          class="shrink-0"
          @click="assinarPlano('pro_anual')"
        >
          Assinar PRO com 2 meses grátis
        </UiBotao>
      </div>

      <!-- Barra de progresso do Trial -->
      <div class="mt-5 max-w-xl">
        <div class="flex items-center justify-between text-xs text-muted mb-1.5">
          <span>Tempo de teste restante</span>
          <span class="font-medium text-wine-tint">{{ licenca?.diasRestantes }} de 14 dias</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            class="h-full rounded-full bg-linear-to-r from-wine to-wine-tint transition-all duration-500"
            :style="{ width: `${trialPct}%` }"
          />
        </div>
      </div>
    </section>

    <!-- 2. Estado PRO Ativo (Assinatura) -->
    <section
      v-else-if="licenca?.plano === 'pro' && assinatura"
      class="rounded-xl border border-success/30 bg-surface p-6 sm:p-7"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <UiEtiqueta cor="bg-success/15 text-success">
              Assinatura PRO Ativa
            </UiEtiqueta>
            <span class="text-xs text-muted">
              Plano {{ assinatura.planoNome }} ({{ moeda(assinatura.precoCentavos) }}/{{ assinatura.periodicidade === 'ANUAL' ? 'ano' : 'mês' }})
            </span>
          </div>
          <h2 class="mt-2 text-xl font-semibold text-text">
            Você tem acesso ilimitado a todos os módulos
          </h2>

          <p v-if="assinatura.cancelaNoFimDoPeriodo" class="mt-1 text-sm text-warning">
            Cancelamento agendado: sua assinatura permanecerá ativa até <strong>{{ dataCurta(assinatura.periodoAtualFim) }}</strong>. Nenhuma nova cobrança será realizada.
          </p>
          <p v-else class="mt-1 text-sm text-muted">
            Próxima renovação automática em <strong class="text-text">{{ dataCurta(assinatura.periodoAtualFim) }}</strong>.
          </p>
        </div>

        <div>
          <UiBotao
            v-if="assinatura.cancelaNoFimDoPeriodo"
            variante="primaria"
            :disabled="reativando"
            @click="reativarAssinatura"
          >
            {{ reativando ? 'Reativando…' : 'Reativar assinatura' }}
          </UiBotao>
          <UiBotao
            v-else
            variante="secundaria"
            class="text-xs text-danger hover:border-danger/40"
            @click="modalCancelarAberto = true"
          >
            Cancelar assinatura
          </UiBotao>
        </div>
      </div>
    </section>

    <!-- 3. Estado Gratuito -->
    <section
      v-else
      class="rounded-xl border border-border bg-surface p-6 sm:p-7"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <UiEtiqueta cor="bg-surface-2 text-muted">
            Plano Gratuito
          </UiEtiqueta>
          <h2 class="mt-2 text-xl font-semibold text-text">
            Seu período de teste encerrou
          </h2>
          <p class="mt-1 max-w-2xl text-sm text-muted">
            Você continua podendo vender fotos de eventos normalmente com taxa de 10%. Para publicar ensaios, criar galerias privadas com seleção do cliente e utilizar a gestão de estúdio no desktop, faça o upgrade para o PRO.
          </p>
        </div>

        <UiBotao
          variante="primaria"
          class="shrink-0"
          @click="assinarPlano('pro_mensal')"
        >
          Assinar Plano PRO
        </UiBotao>
      </div>
    </section>

    <!-- Seção de Duas Colunas: Chave de Licença Desktop e Limites -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Card Licença Desktop -->
      <UiCartao
        titulo="Licença do FotoRAW Desktop"
        descricao="Chave de ativação para o aplicativo local no Windows ou macOS."
      >
        <div class="space-y-4">
          <div>
            <p class="rotulo">Sua Chave de Ativação</p>
            <div class="flex items-center gap-2 rounded-lg border border-border bg-bg/80 p-3">
              <span class="flex-1 font-mono text-base font-semibold tracking-wider text-text truncate select-all">
                {{ licenca?.chave || 'CHAVE-INDISPONIVEL' }}
              </span>
              <UiBotao
                variante="secundaria"
                class="shrink-0 text-xs"
                @click="copiarChave"
              >
                <svg
                  v-if="!copiadoChave"
                  viewBox="0 0 24 24"
                  class="mr-1.5 size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  class="mr-1.5 size-4 text-success"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ copiadoChave ? 'Copiado!' : 'Copiar' }}
              </UiBotao>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg border border-border bg-surface-2/40 p-3">
              <span class="text-muted block">Status da licença</span>
              <span class="font-medium text-success block mt-0.5">
                {{ licenca?.status === 'ATIVA' ? 'Ativa no Desktop' : licenca?.status }}
              </span>
            </div>
            <div class="rounded-lg border border-border bg-surface-2/40 p-3">
              <span class="text-muted block">Validade</span>
              <span class="font-medium text-text block mt-0.5">
                {{ licenca?.validaAte ? dataCurta(licenca.validaAte) : 'Enquanto durar a assinatura' }}
              </span>
            </div>
          </div>

          <p class="text-xs text-muted leading-relaxed">
            <strong>Dica de ativação automática:</strong> Ao abrir o FotoRAW Desktop e fazer login com seu e-mail e senha, esta licença é ativada instantaneamente sem necessidade de colar a chave.
          </p>
        </div>
      </UiCartao>

      <!-- Card Limites e Recursos -->
      <UiCartao
        titulo="Capacidade & Recursos da Conta"
        descricao="Limites e permissões liberados para seu uso atual."
      >
        <div class="space-y-4">
          <!-- Grid de Métricas de Limite -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg border border-border bg-surface-2/40 p-3">
              <span class="text-muted block">Galerias Ativas</span>
              <span class="text-lg font-semibold tabular-nums text-text block mt-0.5">
                {{ num(licenca?.recursos.limite_galerias_ativas) }}
              </span>
            </div>
            <div class="rounded-lg border border-border bg-surface-2/40 p-3">
              <span class="text-muted block">Fotos por Galeria</span>
              <span class="text-lg font-semibold tabular-nums text-text block mt-0.5">
                {{ num(licenca?.recursos.limite_fotos_por_galeria) }}
              </span>
            </div>
            <div class="rounded-lg border border-border bg-surface-2/40 p-3">
              <span class="text-muted block">Armazenamento em Nuvem</span>
              <span class="text-lg font-semibold tabular-nums text-text block mt-0.5">
                {{ gb(licenca?.recursos.limite_armazenamento_mb) }}
              </span>
            </div>
            <div class="rounded-lg border border-border bg-surface-2/40 p-3">
              <span class="text-muted block">Máquinas Autorizadas</span>
              <span class="text-lg font-semibold tabular-nums text-text block mt-0.5">
                {{ num(licenca?.recursos.limite_dispositivos) }}
              </span>
            </div>
          </div>

          <!-- Lista de Permissões -->
          <ul class="space-y-2 text-xs border-t border-border pt-3">
            <li v-for="rec in recursosLicenca" :key="rec.rotulo" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  class="flex size-4 shrink-0 items-center justify-center rounded-full"
                  :class="rec.ok ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'"
                >
                  <svg v-if="rec.ok" viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M5 12.5 10 17l9-10" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M7 7l10 10M17 7 7 17" />
                  </svg>
                </span>
                <span :class="rec.ok ? 'text-text' : 'text-muted'">{{ rec.rotulo }}</span>
              </div>
              <span v-if="!rec.ok" class="text-[10px] font-semibold uppercase text-wine-tint">
                Exige PRO
              </span>
            </li>
          </ul>
        </div>
      </UiCartao>
    </div>

    <!-- Catálogo de Planos PRO (Opções de Assinatura) -->
    <UiCartao
      titulo="Planos FotoRAW PRO"
      descricao="Escolha a periodicidade ideal para o seu estúdio e garanta todos os recursos desbloqueados."
    >
      <div class="grid gap-6 md:grid-cols-2 pt-2">
        <!-- PRO Mensal -->
        <div
          class="relative flex flex-col justify-between rounded-xl border p-5 transition-all"
          :class="
            assinatura?.planoCodigo === 'pro_mensal' && !assinatura?.cancelaNoFimDoPeriodo
              ? 'border-wine bg-wine-dim/30'
              : 'border-border bg-surface-2/20 hover:border-muted/50'
          "
        >
          <div>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-text">PRO Mensal</h3>
              <UiEtiqueta
                v-if="assinatura?.planoCodigo === 'pro_mensal' && !assinatura?.cancelaNoFimDoPeriodo"
                cor="bg-wine/30 text-wine-tint"
              >
                Plano Atual
              </UiEtiqueta>
            </div>
            <p class="mt-1 text-xs text-muted">Flexibilidade total, cancele quando desejar.</p>

            <div class="mt-4 flex items-baseline gap-1">
              <span class="text-3xl font-bold tracking-tight text-text">
                {{ moeda(planoMensal?.precoCentavos ?? 4990) }}
              </span>
              <span class="text-xs text-muted">/mês</span>
            </div>

            <ul class="mt-5 space-y-2 text-xs text-muted">
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Galerias e fotos <strong>ilimitadas</strong></span>
              </li>
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span><strong>200 GB</strong> de armazenamento na nuvem</span>
              </li>
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Até <strong>3 computadores</strong> conectados</span>
              </li>
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Ensaios, portfólio e seleção do cliente</span>
              </li>
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Gestão completa do estúdio no desktop</span>
              </li>
            </ul>
          </div>

          <div class="pt-6">
            <UiBotao
              variante="secundaria"
              class="w-full"
              :disabled="
                assinandoCodigo === 'pro_mensal' ||
                (assinatura?.planoCodigo === 'pro_mensal' && !assinatura?.cancelaNoFimDoPeriodo)
              "
              @click="assinarPlano('pro_mensal')"
            >
              {{
                assinandoCodigo === 'pro_mensal'
                  ? 'Processando…'
                  : assinatura?.planoCodigo === 'pro_mensal' && !assinatura?.cancelaNoFimDoPeriodo
                    ? 'Plano Ativo'
                    : 'Assinar PRO Mensal'
              }}
            </UiBotao>
          </div>
        </div>

        <!-- PRO Anual -->
        <div
          class="relative flex flex-col justify-between rounded-xl border p-5 transition-all"
          :class="
            assinatura?.planoCodigo === 'pro_anual' && !assinatura?.cancelaNoFimDoPeriodo
              ? 'border-wine bg-wine-dim/30'
              : 'border-wine/60 bg-surface-2/30 hover:border-wine'
          "
        >
          <div class="absolute -top-3 right-4">
            <span class="rounded-full bg-wine px-3 py-0.5 text-[11px] font-semibold text-white shadow-md">
              Economize 2 meses
            </span>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-text">PRO Anual</h3>
              <UiEtiqueta
                v-if="assinatura?.planoCodigo === 'pro_anual' && !assinatura?.cancelaNoFimDoPeriodo"
                cor="bg-wine/30 text-wine-tint"
              >
                Plano Atual
              </UiEtiqueta>
            </div>
            <p class="mt-1 text-xs text-muted">Melhor custo-benefício para o ano todo.</p>

            <div class="mt-4 flex items-baseline gap-1">
              <span class="text-3xl font-bold tracking-tight text-text">
                {{ moeda(planoAnual?.precoCentavos ?? 49900) }}
              </span>
              <span class="text-xs text-muted">/ano (~R$ 41,58/mês)</span>
            </div>

            <ul class="mt-5 space-y-2 text-xs text-muted">
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Tudo incluso no PRO Mensal</span>
              </li>
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span><strong>2 meses grátis</strong> de economia direta</span>
              </li>
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Garantia de preço fixo por 12 meses</span>
              </li>
              <li class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 text-success shrink-0" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Cobrança anual única</span>
              </li>
            </ul>
          </div>

          <div class="pt-6">
            <UiBotao
              variante="primaria"
              class="w-full"
              :disabled="
                assinandoCodigo === 'pro_anual' ||
                (assinatura?.planoCodigo === 'pro_anual' && !assinatura?.cancelaNoFimDoPeriodo)
              "
              @click="assinarPlano('pro_anual')"
            >
              {{
                assinandoCodigo === 'pro_anual'
                  ? 'Processando…'
                  : assinatura?.planoCodigo === 'pro_anual' && !assinatura?.cancelaNoFimDoPeriodo
                    ? 'Plano Ativo'
                    : 'Assinar PRO Anual'
              }}
            </UiBotao>
          </div>
        </div>
      </div>
    </UiCartao>

    <!-- Extrato de Faturas -->
    <UiCartao
      titulo="Faturas & Cobranças"
      descricao="Histórico de pagamentos e cobranças da sua assinatura."
    >
      <div v-if="faturas && faturas.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th scope="col" class="pb-3 pr-4 font-medium">Vencimento</th>
              <th scope="col" class="pb-3 pr-4 font-medium">Valor</th>
              <th scope="col" class="pb-3 pr-4 font-medium">Status</th>
              <th scope="col" class="pb-3 pr-4 font-medium">Data do Pagamento</th>
              <th scope="col" class="pb-3 font-medium">Comprovante</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="fatura in faturas" :key="fatura.id" class="hover:bg-surface-2/40">
              <td class="py-3.5 pr-4 text-xs font-mono text-muted">
                {{ dataCurta(fatura.vencimento) }}
              </td>
              <td class="py-3.5 pr-4 font-medium tabular-nums text-text">
                {{ moeda(fatura.valorCentavos) }}
              </td>
              <td class="py-3.5 pr-4">
                <UiEtiqueta :cor="corStatusFatura[fatura.status]">
                  {{ rotuloStatusFatura[fatura.status] || fatura.status }}
                </UiEtiqueta>
              </td>
              <td class="py-3.5 pr-4 text-xs text-muted">
                {{ dataHora(fatura.pagaEm) }}
              </td>
              <td class="py-3.5 text-xs text-muted">
                <span v-if="fatura.status === 'PAGA'" class="text-success font-medium">
                  Liquidada ✓
                </span>
                <span v-else-if="fatura.urlBoletoPix" class="text-wine-tint hover:underline cursor-pointer">
                  Pagar Pix / Boleto
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
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <p class="text-sm font-medium text-text">Nenhuma fatura emitida ainda</p>
        <p class="mt-1 max-w-sm text-xs text-muted">
          Ao assinar o plano PRO, as faturas e recibos de pagamento de cada ciclo serão exibidos nesta área.
        </p>
      </div>
    </UiCartao>

    <!-- Modal de Confirmação de Cancelamento -->
    <div
      v-if="modalCancelarAberto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
    >
      <div class="card max-w-md w-full p-6 space-y-4 shadow-2xl border-border">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-full bg-danger/15 text-danger">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-text">Cancelar renovação do PRO?</h3>
            <p class="text-xs text-muted">Seu acesso continuará até o fim do período já pago.</p>
          </div>
        </div>

        <p class="text-xs text-muted leading-relaxed">
          Ao cancelar, seus recursos PRO permanecerão liberados até <strong class="text-text">{{ dataCurta(assinatura?.periodoAtualFim) }}</strong>. Nenhuma nova cobrança será realizada. Após essa data, sua conta voltará ao plano gratuito.
        </p>

        <div>
          <label class="block">
            <span class="rotulo">Motivo do cancelamento (opcional)</span>
            <textarea
              v-model="motivoCancelamento"
              rows="2"
              placeholder="Conte-nos o motivo para nos ajudar a melhorar..."
              class="campo h-auto py-2 text-xs"
            />
          </label>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <UiBotao
            variante="secundaria"
            :disabled="cancelando"
            @click="modalCancelarAberto = false"
          >
            Voltar
          </UiBotao>
          <UiBotao
            variante="primaria"
            class="bg-danger hover:bg-danger/80"
            :disabled="cancelando"
            @click="confirmarCancelamento"
          >
            {{ cancelando ? 'Cancelando…' : 'Confirmar cancelamento' }}
          </UiBotao>
        </div>
      </div>
    </div>
  </div>
</template>
