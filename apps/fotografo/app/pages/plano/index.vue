<script setup lang="ts">
import type { CartaoTokenizado } from '~/composables/useCartaoMercadoPago';
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

// cartão cadastrado: o MP confirma a 1ª cobrança em até ~1 h; enquanto a página está
// aberta, olha de tempos em tempos e avisa quando liberar
let esperando: ReturnType<typeof setInterval> | null = null;
function esperarConfirmacao() {
  if (esperando || !assinatura.value?.cartaoEmAnalise) return;
  let voltas = 0;
  esperando = setInterval(async () => {
    voltas++;
    await refreshStatus();
    if (!assinatura.value?.aguardandoPagamento) {
      clearInterval(esperando!);
      esperando = null;
      await sessao.carregarEu();
      if (assinatura.value) alertaSucesso.value = `Pagamento confirmado! O plano ${assinatura.value.planoNome} está liberado.`;
    } else if (voltas >= 40) {
      clearInterval(esperando!);
      esperando = null;
    }
  }, 15_000);
}
onMounted(esperarConfirmacao);
onBeforeUnmount(() => esperando && clearInterval(esperando));

const planoDaLicenca = computed(() =>
  planos.value.find((p) => p.codigo === licenca.value?.planoCodigo),
);

function ehPlanoAtual(codigo: string): boolean {
  if (codigo === 'gratuito') return licenca.value?.plano === 'gratuito';
  const a = assinatura.value;
  return a?.planoCodigo === codigo && !a.cancelaNoFimDoPeriodo && !a.aguardandoPagamento;
}

/** pediu este plano e ainda não pagou: o botão abre o cartão de novo */
function pedidoPendente(codigo: string): boolean {
  const a = assinatura.value;
  return a?.planoCodigo === codigo && a.aguardandoPagamento;
}

function descricaoDoPlano(p: PlanoCatalogo): string {
  if (p.precoCentavos === 0) return 'Para começar a vender fotos de evento.';
  return p.permiteEnsaio ? 'Eventos, ensaios e a gestão do estúdio.' : 'Para quem vive de fotografar eventos.';
}

function verPlanos() {
  document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });
}

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
const cartao = useCartaoMercadoPago();
const planoNoCartao = ref<PlanoCatalogo | null>(null);
const erroCartao = ref<string | null>(null);

async function assinarPlano(codigo: string) {
  alertaErro.value = null;
  alertaSucesso.value = null;
  const plano = planos.value.find((p) => p.codigo === codigo);
  const chave = statusPlano.value?.chaveMercadoPago;
  if (!plano) return;
  // sem Mercado Pago configurado (dev): só registra o pedido, o admin marca paga
  if (!chave) return enviarAssinatura(plano);

  planoNoCartao.value = plano;
  erroCartao.value = null;
  await nextTick();
  await cartao.montar({
    container: 'cartao-assinatura',
    chavePublica: chave,
    valor: plano.precoCentavos / 100,
    email: sessao.conta?.email,
    onCartao: (c) => enviarAssinatura(plano, c),
    onErro: (m) => (erroCartao.value = m),
  });
}

async function fecharCartao() {
  await cartao.desmontar();
  planoNoCartao.value = null;
}

async function enviarAssinatura(plano: PlanoCatalogo, dadosCartao?: CartaoTokenizado) {
  assinandoCodigo.value = plano.codigo;
  erroCartao.value = null;
  try {
    const atualizado = await api<StatusPlanoFotografo>('/planos/assinar', {
      method: 'POST',
      body: { planoCodigo: plano.codigo, ...(dadosCartao ? { cartao: dadosCartao } : {}) },
    });
    statusPlano.value = atualizado;
    await fecharCartao();
    await sessao.carregarEu();
    alertaSucesso.value = dadosCartao
      ? `Cartão cadastrado no plano ${plano.nome}! O Mercado Pago confirma a 1ª cobrança em até 1 hora e o plano é liberado sozinho — pode fechar esta página.`
      : `Pedido do plano ${plano.nome} registrado. O plano é liberado assim que o pagamento for confirmado.`;
    esperarConfirmacao();
  } catch (err: unknown) {
    const fetchErr = err as { data?: { mensagem?: string; message?: string } };
    const mensagem =
      fetchErr?.data?.mensagem ?? fetchErr?.data?.message ?? 'Não foi possível concluir a assinatura. Tente novamente.';
    // com o formulário aberto o erro aparece nele (o Brick deixa tentar outro cartão)
    if (planoNoCartao.value) erroCartao.value = mensagem;
    else alertaErro.value = mensagem;
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
    alertaSucesso.value = atualizado.assinatura
      ? 'Cancelamento agendado. Você continua com os recursos do seu plano até o fim do período já pago.'
      : 'Pedido cancelado. Nada foi cobrado.';
  } catch (err: unknown) {
    const fetchErr = err as { data?: { mensagem?: string; message?: string } };
    alertaErro.value =
      fetchErr?.data?.mensagem ?? fetchErr?.data?.message ?? 'Erro ao agendar cancelamento da assinatura.';
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
    const fetchErr = err as { data?: { mensagem?: string; message?: string } };
    alertaErro.value =
      fetchErr?.data?.mensagem ?? fetchErr?.data?.message ?? 'Erro ao reativar assinatura.';
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

// vencimento e período são dias (meia-noite UTC no banco): em UTC pra não virar o dia anterior
function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

const semLimite = 'Sem limite';
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

const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function itensDoPlano(p: PlanoCatalogo): string[] {
  const itens = [
    `${gb(p.limiteArmazenamentoMb)} de armazenamento na nuvem`,
    p.comissaoEventoPct > 0
      ? `Vendas de evento com taxa de ${pct(p.comissaoEventoPct)}%`
      : 'Vendas de evento sem taxa do FotoRAW',
  ];
  if (p.limiteGaleriasAtivas === null && p.limiteFotosPorGaleria === null) {
    itens.push('Galerias e fotos sem limite de quantidade');
  } else {
    if (p.limiteGaleriasAtivas !== null) itens.push(`Até ${num(p.limiteGaleriasAtivas)} galerias ativas`);
    if (p.limiteFotosPorGaleria !== null) itens.push(`Até ${num(p.limiteFotosPorGaleria)} fotos por galeria`);
  }
  if (p.limiteDispositivos !== null) {
    itens.push(`Até ${p.limiteDispositivos} ${p.limiteDispositivos === 1 ? 'computador' : 'computadores'}`);
  }
  if (p.permiteEnsaio) itens.push('Ensaios, portfólio e seleção do cliente');
  if (p.permiteGestaoEstudio) itens.push('Gestão completa do estúdio no desktop');
  return itens;
}

const recursosLicenca = computed(() => {
  const r = licenca.value?.recursos;
  if (!r) return [];
  const taxa = planoDaLicenca.value?.comissaoEventoPct;
  return [
    {
      rotulo:
        taxa === undefined
          ? 'Vender fotos de evento'
          : taxa > 0
            ? `Vender fotos de evento (${pct(taxa)}% de taxa)`
            : 'Vender fotos de evento (sem taxa)',
      ok: r.permite_evento,
    },
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

    <UiAlerta v-if="assinatura?.aguardandoPagamento" tipo="aviso">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>
          <strong>Assinatura {{ assinatura.planoNome }} aguardando pagamento</strong>
          ({{ moeda(assinatura.precoCentavos) }}/mês).
          <template v-if="assinatura.cartaoEmAnalise">
            Cartão cadastrado — o Mercado Pago confirma a 1ª cobrança em até 1 hora e o plano é
            liberado sozinho, aqui e no desktop.
          </template>
          <template v-else>
            Falta cadastrar o cartão para concluir.
          </template>
        </span>
        <span class="flex shrink-0 gap-2">
          <UiBotao
            v-if="!assinatura.cartaoEmAnalise && statusPlano?.chaveMercadoPago"
            variante="primaria"
            class="text-xs"
            @click="assinarPlano(assinatura.planoCodigo)"
          >
            Cadastrar cartão
          </UiBotao>
          <UiBotao variante="secundaria" class="text-xs" :disabled="cancelando" @click="modalCancelarAberto = true">
            Cancelar pedido
          </UiBotao>
        </span>
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

        <UiBotao variante="primaria" class="shrink-0" @click="verPlanos">
          Ver planos
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
              Assinatura ativa
            </UiEtiqueta>
            <span class="text-xs text-muted">
              {{ moeda(assinatura.precoCentavos) }}/{{ assinatura.periodicidade === 'ANUAL' ? 'ano' : 'mês' }}
            </span>
          </div>
          <h2 class="mt-2 text-xl font-semibold text-text">
            Plano {{ assinatura.planoNome }}
          </h2>

          <p v-if="assinatura.cancelaNoFimDoPeriodo" class="mt-1 text-sm text-warning">
            Cancelamento agendado: sua assinatura permanecerá ativa até <strong>{{ dataCurta(assinatura.periodoAtualFim) }}</strong>. Nenhuma nova cobrança será realizada.
          </p>
          <p v-else class="mt-1 text-sm text-muted">
            {{ assinatura.cobrancaAutomatica ? 'Próxima cobrança no cartão em' : 'Próxima renovação em' }}
            <strong class="text-text">{{ dataCurta(assinatura.periodoAtualFim) }}</strong>.
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
            Você continua vendendo fotos de evento normalmente, com taxa de {{ pct(planoDaLicenca?.comissaoEventoPct ?? 10) }}%. Para mais espaço e taxa menor nos eventos, veja o plano Evento; para ensaios, galeria privada com seleção do cliente e a gestão do estúdio no desktop, o PRO ou o Business.
          </p>
        </div>

        <UiBotao variante="primaria" class="shrink-0" @click="verPlanos">
          Ver planos
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
              <span v-if="licenca?.recursos.limite_galerias_ativas === null" class="mt-0.5 block text-[11px] text-muted">
                o limite é o espaço em nuvem
              </span>
            </div>
            <div class="rounded-lg border border-border bg-surface-2/40 p-3">
              <span class="text-muted block">Fotos por Galeria</span>
              <span class="text-lg font-semibold tabular-nums text-text block mt-0.5">
                {{ num(licenca?.recursos.limite_fotos_por_galeria) }}
              </span>
              <span v-if="licenca?.recursos.limite_fotos_por_galeria === null" class="mt-0.5 block text-[11px] text-muted">
                o limite é o espaço em nuvem
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

    <!-- Catálogo de planos pagos (vem do banco; o admin edita preço e limites) -->
    <UiCartao
      id="planos"
      titulo="Planos FotoRAW"
      descricao="Cobrança mensal automática no cartão de crédito. Cancele quando quiser."
    >
      <div class="grid gap-6 pt-2 md:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="p in planos"
          :key="p.codigo"
          class="relative flex flex-col justify-between rounded-xl border p-5 transition-all"
          :class="
            ehPlanoAtual(p.codigo)
              ? 'border-wine bg-wine-dim/30'
              : 'border-border bg-surface-2/20 hover:border-muted/50'
          "
        >
          <div>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-text">{{ p.nome }}</h3>
              <UiEtiqueta v-if="ehPlanoAtual(p.codigo)" cor="bg-wine/30 text-wine-tint">
                Plano Atual
              </UiEtiqueta>
              <UiEtiqueta v-else-if="pedidoPendente(p.codigo)" cor="bg-warning/15 text-warning">
                Aguardando pagamento
              </UiEtiqueta>
            </div>
            <p class="mt-1 text-xs text-muted">
              {{ descricaoDoPlano(p) }}
            </p>

            <div class="mt-4 flex items-baseline gap-1">
              <template v-if="p.precoCentavos > 0">
                <span class="text-3xl font-bold tracking-tight text-text">{{ moeda(p.precoCentavos) }}</span>
                <span class="text-xs text-muted">/mês</span>
              </template>
              <span v-else class="text-3xl font-bold tracking-tight text-text">Grátis</span>
            </div>

            <ul class="mt-5 space-y-2 text-xs">
              <li v-for="item in itensDoPlano(p)" :key="item" class="flex items-center gap-2 text-text">
                <svg viewBox="0 0 24 24" class="size-4 shrink-0 text-success" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>

          <div class="pt-6">
            <UiBotao v-if="p.precoCentavos === 0" variante="secundaria" class="w-full" disabled>
              {{ ehPlanoAtual(p.codigo) ? 'Plano Atual' : 'Sempre disponível' }}
            </UiBotao>
            <UiBotao
              v-else
              variante="primaria"
              class="w-full"
              :disabled="assinandoCodigo === p.codigo || ehPlanoAtual(p.codigo)"
              @click="assinarPlano(p.codigo)"
            >
              {{
                assinandoCodigo === p.codigo
                  ? 'Processando…'
                  : ehPlanoAtual(p.codigo)
                    ? 'Plano Ativo'
                    : pedidoPendente(p.codigo)
                      ? 'Concluir pagamento'
                      : `Assinar ${p.nome}`
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
                <span v-else-if="assinatura?.cobrancaAutomatica && fatura.status === 'PENDENTE'">
                  Cobrança automática no cartão
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
          Ao assinar um plano, as faturas e recibos de pagamento de cada ciclo serão exibidos nesta área.
        </p>
      </div>
    </UiCartao>

    <!-- Cartão: formulário do Mercado Pago embutido (Card Payment Brick) -->
    <div
      v-if="planoNoCartao"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-6"
    >
      <!-- cabe na tela: a janela rola por dentro, o topo (título e erro) nunca some -->
      <div class="card flex max-h-full w-full max-w-md flex-col border-border shadow-2xl">
        <div class="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <h3 class="text-base font-semibold text-text">Assinar o plano {{ planoNoCartao.nome }}</h3>
            <p class="text-xs text-muted">
              {{ moeda(planoNoCartao.precoCentavos) }}/mês, cobrado automaticamente no cartão de crédito.
              Cancele quando quiser.
            </p>
          </div>
          <button class="text-xs text-muted hover:text-text" :disabled="!!assinandoCodigo" @click="fecharCartao">
            Fechar
          </button>
        </div>

        <div class="space-y-3 overflow-y-auto p-4">
          <UiAlerta v-if="erroCartao" tipo="erro">{{ erroCartao }}</UiAlerta>

          <div id="cartao-assinatura" />

          <p class="text-[11px] leading-relaxed text-muted">
          Os dados do cartão vão direto para o Mercado Pago — o FotoRAW nunca vê o número do
          cartão. Para validar, o Mercado Pago pode fazer uma cobrança de valor baixo que é
          devolvida na hora; a 1ª mensalidade é cobrada em até 1 hora.
          </p>
        </div>
      </div>
    </div>

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
            <h3 class="text-base font-semibold text-text">
              {{ assinatura?.aguardandoPagamento ? 'Cancelar o pedido?' : 'Cancelar a renovação do plano?' }}
            </h3>
            <p class="text-xs text-muted">
              {{ assinatura?.aguardandoPagamento ? 'Nada foi cobrado ainda.' : 'Seu acesso continuará até o fim do período já pago.' }}
            </p>
          </div>
        </div>

        <p class="text-xs text-muted leading-relaxed">
          <template v-if="assinatura?.aguardandoPagamento">
            O pedido do plano {{ assinatura.planoNome }} é cancelado e nenhuma cobrança será feita. Você pode assinar de novo quando quiser.
          </template>
          <template v-else>
            Ao cancelar, os recursos do seu plano continuam liberados até <strong class="text-text">{{ dataCurta(assinatura?.periodoAtualFim) }}</strong>. {{ assinatura?.cobrancaAutomatica ? 'A cobrança no cartão é interrompida.' : 'Nenhuma nova cobrança será realizada.' }} Após essa data, sua conta voltará ao plano gratuito.
          </template>
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
