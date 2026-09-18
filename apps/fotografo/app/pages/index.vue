<script setup lang="ts">
definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Início' });

const sessao = useSessao();
const api = useApi();
const { webUrl } = useRuntimeConfig().public;
const eu = computed(() => sessao.eu);

// --- saudação e link público ------------------------------------------------
const saudacao = computed(() => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
});
const linkPublico = computed(() => `${webUrl}/@${sessao.conta?.slug ?? ''}`);
const linkBonito = computed(() => linkPublico.value.replace(/^https?:\/\//, ''));
const copiado = ref(false);
async function copiarLink() {
  try {
    await navigator.clipboard.writeText(linkPublico.value);
    copiado.value = true;
    setTimeout(() => (copiado.value = false), 1800);
  } catch {
    /* sem clipboard (http sem https): o link continua visível pra copiar na mão */
  }
}

// --- reenviar verificação --------------------------------------------------
const reenviando = ref(false);
const reenviado = ref(false);
async function reenviarVerificacao() {
  if (!sessao.conta) return;
  reenviando.value = true;
  try {
    await api('/auth/reenviar-verificacao', {
      method: 'POST',
      body: { email: sessao.conta.email },
    });
    reenviado.value = true;
  } finally {
    reenviando.value = false;
  }
}

// --- primeiros passos --------------------------------------------------------
interface Passo {
  id: string;
  titulo: string;
  texto: string;
  feito: boolean;
  acao?: { rotulo: string; to?: string; onClick?: () => void; ocupado?: boolean };
}
const passos = computed<Passo[]>(() => {
  const e = eu.value;
  const perfilOk = !!e?.perfil?.cidade && !!e?.perfil?.whatsapp;
  return [
    {
      id: 'conta',
      titulo: 'Criar a conta',
      texto: 'Feito — bem-vindo!',
      feito: true,
    },
    {
      id: 'email',
      titulo: 'Confirmar o e-mail',
      texto: e?.conta.emailVerificado
        ? 'E-mail confirmado.'
        : `Enviamos um link pra ${e?.conta.email ?? 'seu e-mail'}.`,
      feito: !!e?.conta.emailVerificado,
      acao: e?.conta.emailVerificado
        ? undefined
        : {
            rotulo: reenviado.value ? 'Enviado!' : 'Reenviar',
            onClick: reenviarVerificacao,
            ocupado: reenviando.value || reenviado.value,
          },
    },
    {
      id: 'perfil',
      titulo: 'Completar o perfil público',
      texto: perfilOk
        ? 'Cidade e WhatsApp preenchidos.'
        : 'Cidade e WhatsApp ajudam o cliente a te achar.',
      feito: perfilOk,
      acao: perfilOk ? undefined : { rotulo: 'Completar', to: '/perfil' },
    },
    {
      id: 'desktop',
      titulo: 'Conectar o FotoRAW desktop',
      texto: 'Entre no desktop com este mesmo e-mail e senha.',
      feito: false,
      acao: { rotulo: 'Como fazer', to: '/dispositivos' },
    },
    {
      id: 'mp',
      titulo: 'Conectar o Mercado Pago',
      texto: 'Sem isso a galeria publica, mas não vende.',
      feito: false,
      acao: { rotulo: 'Em breve', to: '/financeiro' },
    },
  ];
});
const feitos = computed(() => passos.value.filter((p) => p.feito).length);
const progresso = computed(() => Math.round((feitos.value / passos.value.length) * 100));

// --- plano --------------------------------------------------------------------
const rotuloPlano = computed(() => {
  const l = eu.value?.licenca;
  if (!l) return '';
  return { gratuito: 'Plano gratuito', trial: 'PRO · período de teste', pro: 'PRO' }[l.plano];
});
const trialPct = computed(() => {
  const l = eu.value?.licenca;
  if (!l?.validaAte || l.diasRestantes === null) return null;
  const total = 14;
  return Math.max(4, Math.min(100, Math.round((l.diasRestantes / total) * 100)));
});
const semLimite = '∞';
const num = (n: number | null) => (n === null ? semLimite : n.toLocaleString('pt-BR'));
const gb = (mb: number | null) =>
  mb === null ? semLimite : mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
const dataBr = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <!-- boas-vindas -->
    <section
      class="relative overflow-hidden rounded-xl border border-wine/30 bg-linear-to-br from-wine-dim via-surface to-surface p-6 sm:p-8"
    >
      <div
        class="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-wine/15 blur-3xl"
      />
      <div class="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p class="text-sm text-muted">{{ saudacao }},</p>
          <h1 class="mt-0.5 text-3xl font-semibold tracking-tight">{{ sessao.conta?.nome }} 👋</h1>
          <p class="mt-2 max-w-xl text-muted">
            Este é o seu painel. As galerias você publica pelo desktop; aqui você acompanha vendas,
            plano e o que aparece na sua vitrine.
          </p>
        </div>

        <div class="w-full sm:w-auto">
          <p class="rotulo">Sua vitrine</p>
          <div
            class="flex items-center gap-2 rounded-lg border border-border bg-bg/70 py-1.5 pl-3 pr-1.5 backdrop-blur"
          >
            <a
              :href="linkPublico"
              target="_blank"
              class="truncate text-sm font-medium text-wine-tint hover:underline"
            >
              {{ linkBonito }}
            </a>
            <button
              type="button"
              class="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
              @click="copiarLink"
            >
              {{ copiado ? 'Copiado ✓' : 'Copiar' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- indicadores -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="card flex items-start gap-4 p-5">
        <span class="pastilha text-wine-tint">
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 19V9l4 4 4-7 4 5 4-3v11z" />
          </svg>
        </span>
        <div class="min-w-0">
          <p class="rotulo">Vendas no mês</p>
          <p class="text-2xl font-semibold tabular-nums">R$ 0,00</p>
          <p class="text-xs text-muted">nenhuma venda ainda</p>
        </div>
      </div>
      <div class="card flex items-start gap-4 p-5">
        <span class="pastilha text-wine-tint">
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M7 12h.01M17 12h.01" />
          </svg>
        </span>
        <div class="min-w-0">
          <p class="rotulo">A receber</p>
          <p class="text-2xl font-semibold tabular-nums">R$ 0,00</p>
          <p class="text-xs text-muted">repasse via Mercado Pago</p>
        </div>
      </div>
      <div class="card flex items-start gap-4 p-5">
        <span class="pastilha text-wine-tint">
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" />
          </svg>
        </span>
        <div class="min-w-0">
          <p class="rotulo">Galerias no ar</p>
          <p class="text-2xl font-semibold tabular-nums">0</p>
          <p class="text-xs text-muted">publique pelo desktop</p>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-5">
      <!-- primeiros passos -->
      <section class="card p-5 lg:col-span-3">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-semibold">Primeiros passos</h2>
            <p class="text-sm text-muted">{{ feitos }} de {{ passos.length }} concluídos</p>
          </div>
          <span class="text-sm font-medium tabular-nums text-wine-tint">{{ progresso }}%</span>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            class="h-full rounded-full bg-wine transition-all duration-500"
            :style="{ width: `${progresso}%` }"
          />
        </div>

        <ol class="mt-5 divide-y divide-border">
          <li v-for="p in passos" :key="p.id" class="flex items-center gap-4 py-3">
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs"
              :class="
                p.feito
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-border bg-surface-2 text-muted'
              "
            >
              <svg
                v-if="p.feito"
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12.5 10 17l9-10" />
              </svg>
              <span v-else class="size-2 rounded-full bg-muted/60" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium" :class="{ 'text-muted line-through': p.feito }">
                {{ p.titulo }}
              </p>
              <p class="truncate text-xs text-muted">{{ p.texto }}</p>
            </div>
            <template v-if="p.acao">
              <NuxtLink
                v-if="p.acao.to"
                :to="p.acao.to"
                class="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-wine hover:text-wine-tint"
              >
                {{ p.acao.rotulo }}
              </NuxtLink>
              <button
                v-else
                type="button"
                class="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-wine hover:text-wine-tint disabled:opacity-60"
                :disabled="p.acao.ocupado"
                @click="p.acao.onClick?.()"
              >
                {{ p.acao.rotulo }}
              </button>
            </template>
          </li>
        </ol>
      </section>

      <!-- plano -->
      <section v-if="eu" class="card flex flex-col p-5 lg:col-span-2">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">Seu plano</h2>
            <p class="text-sm text-muted">{{ rotuloPlano }}</p>
          </div>
          <NuxtLink
            to="/plano"
            class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-wine hover:text-wine-tint"
          >
            Ver plano
          </NuxtLink>
        </div>

        <div v-if="trialPct !== null && eu.licenca.validaAte" class="mt-4">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted">
              Teste grátis até <span class="text-text">{{ dataBr(eu.licenca.validaAte) }}</span>
            </span>
            <span
              class="font-medium tabular-nums"
              :class="eu.licenca.diasRestantes! <= 3 ? 'text-warning' : 'text-wine-tint'"
            >
              {{ eu.licenca.diasRestantes }} {{ eu.licenca.diasRestantes === 1 ? 'dia' : 'dias' }}
            </span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full rounded-full bg-linear-to-r from-wine to-wine-tint"
              :style="{ width: `${trialPct}%` }"
            />
          </div>
        </div>

        <dl class="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-bg/60 p-3">
            <dt class="text-xs text-muted">Galerias ativas</dt>
            <dd class="mt-0.5 text-lg font-semibold tabular-nums">
              {{ num(eu.licenca.recursos.limite_galerias_ativas) }}
            </dd>
          </div>
          <div class="rounded-lg bg-bg/60 p-3">
            <dt class="text-xs text-muted">Fotos por galeria</dt>
            <dd class="mt-0.5 text-lg font-semibold tabular-nums">
              {{ num(eu.licenca.recursos.limite_fotos_por_galeria) }}
            </dd>
          </div>
          <div class="rounded-lg bg-bg/60 p-3">
            <dt class="text-xs text-muted">Armazenamento</dt>
            <dd class="mt-0.5 text-lg font-semibold tabular-nums">
              {{ gb(eu.licenca.recursos.limite_armazenamento_mb) }}
            </dd>
          </div>
          <div class="rounded-lg bg-bg/60 p-3">
            <dt class="text-xs text-muted">Máquinas</dt>
            <dd class="mt-0.5 text-lg font-semibold tabular-nums">
              {{ num(eu.licenca.recursos.limite_dispositivos) }}
            </dd>
          </div>
        </dl>

        <p class="mt-4 flex items-center gap-2 text-xs text-muted">
          <span
            class="size-1.5 rounded-full"
            :class="eu.licenca.recursos.permite_galeria_privada ? 'bg-success' : 'bg-muted/50'"
          />
          Galeria privada com seleção do cliente:
          <span class="text-text">{{
            eu.licenca.recursos.permite_galeria_privada ? 'liberada' : 'só no PRO'
          }}</span>
        </p>

        <div v-if="eu.licenca.plano !== 'pro'" class="mt-auto pt-5">
          <UiBotao to="/plano" class="w-full">
            {{
              eu.licenca.plano === 'trial' ? 'Continuar no PRO depois do teste' : 'Conhecer o PRO'
            }}
          </UiBotao>
        </div>
      </section>
    </div>

    <!-- atividade -->
    <section class="card p-5">
      <h2 class="font-semibold">Atividade recente</h2>
      <div
        class="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center"
      >
        <span class="pastilha size-12 text-muted">
          <svg
            viewBox="0 0 24 24"
            class="size-6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" />
          </svg>
        </span>
        <p class="font-medium">Nada por aqui ainda</p>
        <p class="max-w-md text-sm text-muted">
          Quando você publicar a primeira galeria pelo desktop, as vendas e os pedidos aparecem
          aqui.
        </p>
        <NuxtLink to="/dispositivos" class="text-sm font-medium text-wine-tint hover:underline">
          Como conectar o desktop →
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
