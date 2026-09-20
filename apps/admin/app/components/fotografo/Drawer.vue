<script setup lang="ts">
import type { ResumoConta, StatusConta } from '~/types/api';

/**
 * Painel lateral 360 de um fotógrafo: saúde, uso contra o plano, ações rápidas
 * e linha do tempo. Abre por cima da lista (a lista continua atrás, dá pra
 * navegar com ↑↓). `contaId = null` fecha.
 */
const props = defineProps<{ contaId: string | null }>();
const emit = defineEmits<{
  fechar: [];
  navegar: [direcao: -1 | 1];
  /** algo mudou (status, e-mail…) — a lista atrás deve recarregar */
  alterado: [];
}>();

const api = useApi();
const { webUrl } = useRuntimeConfig().public;

const resumo = ref<ResumoConta | null>(null);
const carregando = ref(false);
const erro = ref('');
const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

async function carregar() {
  if (!props.contaId) {
    resumo.value = null;
    return;
  }
  carregando.value = true;
  erro.value = '';
  msg.value = null;
  statusForm.aberto = false;
  try {
    resumo.value = await api<ResumoConta>(`/admin/contas/${props.contaId}/resumo`);
  } catch (e) {
    erro.value = lerErroApi(e).mensagem;
  } finally {
    carregando.value = false;
  }
}
watch(() => props.contaId, carregar, { immediate: true });

// --- teclado: Esc fecha, ↑↓ navega -------------------------------------------
function tecla(e: KeyboardEvent) {
  if (!props.contaId) return;
  const alvo = e.target as HTMLElement | null;
  if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
  if (e.key === 'Escape') emit('fechar');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    emit('navegar', 1);
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    emit('navegar', -1);
  }
}
onMounted(() => document.addEventListener('keydown', tecla));
onBeforeUnmount(() => document.removeEventListener('keydown', tecla));

// --- ações ------------------------------------------------------------------
const ocupado = ref(false);
async function agir(fn: () => Promise<unknown>, ok: string) {
  ocupado.value = true;
  msg.value = null;
  try {
    await fn();
    msg.value = { tipo: 'sucesso', texto: ok };
    await carregar();
    emit('alterado');
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
  }
}
const statusForm = reactive({ aberto: false, status: 'SUSPENSA' as StatusConta, motivo: '' });
function abrirStatus(s: StatusConta) {
  statusForm.status = s;
  statusForm.motivo = '';
  statusForm.aberto = true;
}
function salvarStatus() {
  return agir(
    () =>
      api(`/admin/contas/${props.contaId}/status`, {
        method: 'PATCH',
        body: { status: statusForm.status, motivo: statusForm.motivo },
      }),
    `Conta ${rotuloStatus[statusForm.status]!.toLowerCase()}.`,
  );
}
function reenviar() {
  return agir(
    () => api(`/admin/contas/${props.contaId}/reenviar-verificacao`, { method: 'POST' }),
    'E-mail de confirmação reenviado.',
  );
}

// --- apresentação -------------------------------------------------------------
const corSaude = {
  ok: 'bg-success/15 text-success',
  atencao: 'bg-warning/15 text-warning',
  critico: 'bg-danger/15 text-danger',
};
const rotuloSaude = { ok: 'Saudável', atencao: 'Precisa de atenção', critico: 'Crítico' };

interface Medidor {
  rotulo: string;
  valor: string;
  pct: number | null;
  detalhe?: string;
}
const medidores = computed<Medidor[]>(() => {
  const u = resumo.value?.uso;
  if (!u) return [];
  const pct = (v: number, lim: number | null) =>
    lim === null || lim === 0 ? null : Math.min(100, Math.round((v / lim) * 100));
  const gb = (mb: number) =>
    mb >= 1024
      ? `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
      : `${mb} MB`;
  return [
    {
      rotulo: 'Galerias ativas',
      valor: `${u.galeriasAtivas}${u.limiteGalerias === null ? '' : ` / ${u.limiteGalerias}`}`,
      pct: pct(u.galeriasAtivas, u.limiteGalerias),
    },
    {
      rotulo: 'Armazenamento',
      valor: `${gb(u.armazenamentoMb)}${
        u.limiteArmazenamentoMb === null ? '' : ` / ${gb(u.limiteArmazenamentoMb)}`
      }`,
      pct: pct(u.armazenamentoMb, u.limiteArmazenamentoMb),
      detalhe: `${u.fotos.toLocaleString('pt-BR')} fotos`,
    },
    {
      rotulo: 'Máquinas',
      valor: `${u.dispositivosConectados}${
        u.limiteDispositivos === null ? '' : ` / ${u.limiteDispositivos}`
      }`,
      pct: pct(u.dispositivosConectados, u.limiteDispositivos),
    },
    {
      rotulo: 'Vendas 30 dias',
      valor: dinheiro(u.vendas30d.totalCentavos),
      pct: null,
      detalhe: `${u.vendas30d.pedidos} pedido(s) · comissão ${dinheiro(u.vendas30d.comissaoCentavos)}`,
    },
  ];
});
const corBarra = (pct: number) => (pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-wine');

const iconeEvento: Record<string, string> = {
  conta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  sessao: 'M10 17l5-5-5-5M15 12H3',
  desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
  licenca: 'M6 3h12v18l-6-4-6 4z',
  galeria: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4',
  venda: 'M12 3v18M7 8h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8',
  admin: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-2.7L7 19l1-6-4-4 5.5-.5z',
};
const relativo = (iso: string) => {
  const dif = (Date.now() - new Date(iso).getTime()) / 1000;
  if (dif < 60) return 'agora';
  if (dif < 3600) return `${Math.floor(dif / 60)} min`;
  if (dif < 86400) return `${Math.floor(dif / 3600)} h`;
  const d = Math.floor(dif / 86400);
  return d < 30 ? `${d} d` : data(iso);
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="contaId"
        class="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        @click="emit('fechar')"
      />
    </Transition>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-x-full"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-x-full"
    >
      <aside
        v-if="contaId"
        role="dialog"
        aria-modal="true"
        :aria-label="resumo?.conta.nome ?? 'Fotógrafo'"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-surface shadow-2xl shadow-black/60"
      >
        <!-- topo -->
        <header class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div class="min-w-0">
            <template v-if="resumo">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate text-lg font-semibold">{{ resumo.conta.nome }}</h2>
                <UiEtiqueta :cor="corStatus[resumo.conta.status]">{{
                  rotuloStatus[resumo.conta.status]
                }}</UiEtiqueta>
                <UiEtiqueta :cor="corPlano[resumo.licenca.plano]">
                  {{ resumo.licenca.plano === 'pro' ? 'PRO' : resumo.licenca.plano
                  }}<span v-if="resumo.licenca.diasRestantes !== null">
                    · {{ resumo.licenca.diasRestantes }}d</span
                  >
                </UiEtiqueta>
              </div>
              <p class="mt-0.5 truncate text-xs text-muted">
                @{{ resumo.conta.slug }} · {{ resumo.conta.email }} · desde
                {{ data(resumo.conta.criadoEm) }}
              </p>
            </template>
            <p v-else class="text-sm text-muted">Carregando…</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
              title="Anterior (↑)"
              @click="emit('navegar', -1)"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
            <button
              type="button"
              class="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
              title="Próximo (↓)"
              @click="emit('navegar', 1)"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              class="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
              title="Fechar (Esc)"
              @click="emit('fechar')"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </header>

        <!-- corpo -->
        <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>
          <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

          <template v-if="resumo">
            <!-- saúde -->
            <section>
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="corSaude[resumo.saude.nivel]"
                >
                  <span class="size-1.5 rounded-full bg-current" />
                  {{ rotuloSaude[resumo.saude.nivel] }}
                </span>
                <span v-if="!resumo.conta.emailVerificado" class="text-xs text-muted"
                  >e-mail não confirmado</span
                >
              </div>
              <ul v-if="resumo.saude.alertas.length" class="mt-2 space-y-1">
                <li
                  v-for="a in resumo.saude.alertas"
                  :key="a.codigo"
                  class="flex items-center gap-2 text-sm"
                  :class="a.nivel === 'critico' ? 'text-danger' : 'text-warning'"
                >
                  <span class="size-1.5 shrink-0 rounded-full bg-current" />{{ a.texto }}
                </li>
              </ul>
            </section>

            <!-- uso -->
            <section class="grid grid-cols-2 gap-3">
              <div
                v-for="m in medidores"
                :key="m.rotulo"
                class="rounded-lg border border-border bg-bg/60 p-3"
              >
                <p class="text-[11px] uppercase tracking-wide text-muted">{{ m.rotulo }}</p>
                <p class="mt-0.5 text-base font-semibold tabular-nums">{{ m.valor }}</p>
                <div
                  v-if="m.pct !== null"
                  class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2"
                >
                  <div
                    class="h-full rounded-full"
                    :class="corBarra(m.pct)"
                    :style="{ width: `${m.pct}%` }"
                  />
                </div>
                <p v-if="m.detalhe" class="mt-1 text-[11px] text-muted">{{ m.detalhe }}</p>
              </div>
            </section>

            <p class="text-xs text-muted">
              Último login
              {{ resumo.uso.ultimoLoginEm ? relativo(resumo.uso.ultimoLoginEm) : 'nunca' }} ·
              desktop
              {{ resumo.uso.ultimoDesktopEm ? relativo(resumo.uso.ultimoDesktopEm) : 'nunca' }}
              · publicou
              {{
                resumo.uso.ultimaPublicacaoEm ? relativo(resumo.uso.ultimaPublicacaoEm) : 'nunca'
              }}
            </p>

            <!-- ações -->
            <section class="flex flex-wrap gap-2">
              <UiBotao :to="`/licencas/emitir?contaId=${resumo.conta.id}`">Emitir licença</UiBotao>
              <UiBotao
                v-if="resumo.conta.status === 'ATIVA'"
                variante="secundaria"
                :disabled="ocupado"
                @click="abrirStatus('SUSPENSA')"
                >Suspender</UiBotao
              >
              <UiBotao
                v-else
                variante="secundaria"
                :disabled="ocupado"
                @click="abrirStatus('ATIVA')"
                >Reativar</UiBotao
              >
              <UiBotao
                v-if="!resumo.conta.emailVerificado"
                variante="secundaria"
                :disabled="ocupado"
                @click="reenviar"
                >Reenviar e-mail</UiBotao
              >
              <a
                :href="`${webUrl}/@${resumo.conta.slug}`"
                target="_blank"
                class="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-wine hover:text-wine-tint"
                >Ver vitrine ↗</a
              >
            </section>
            <form
              v-if="statusForm.aberto"
              class="flex flex-wrap items-end gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3"
              @submit.prevent="salvarStatus"
            >
              <div class="min-w-48 flex-1">
                <UiCampo
                  v-model="statusForm.motivo"
                  :rotulo="`Motivo pra ${rotuloStatus[statusForm.status]!.toLowerCase()} (auditoria)`"
                  required
                  autofocus
                />
              </div>
              <UiBotao type="submit" :disabled="ocupado || statusForm.motivo.trim().length < 3"
                >Confirmar</UiBotao
              >
              <UiBotao variante="fantasma" @click="statusForm.aberto = false">Cancelar</UiBotao>
            </form>

            <!-- linha do tempo -->
            <section>
              <h3 class="rotulo">Linha do tempo</h3>
              <ol class="mt-2 space-y-2.5">
                <li
                  v-for="(e, i) in resumo.linhaDoTempo"
                  :key="i"
                  class="flex items-start gap-3 text-sm"
                >
                  <span
                    class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
                    :class="
                      e.tipo === 'admin' ? 'bg-wine-dim text-wine-tint' : 'bg-surface-2 text-muted'
                    "
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="size-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path :d="iconeEvento[e.tipo] ?? iconeEvento.conta" />
                    </svg>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block">{{ e.texto }}</span>
                    <span class="block text-xs text-muted">
                      {{ dataHora(e.quando) }}<span v-if="e.ator"> · {{ e.ator }}</span>
                    </span>
                  </span>
                  <span class="shrink-0 text-xs text-muted">{{ relativo(e.quando) }}</span>
                </li>
              </ol>
              <p v-if="!resumo.linhaDoTempo.length" class="text-sm text-muted">Nada ainda.</p>
            </section>
          </template>
        </div>

        <!-- rodapé -->
        <footer class="flex items-center justify-between border-t border-border px-5 py-3">
          <span class="text-xs text-muted">Esc fecha · ↑↓ navega</span>
          <UiBotao v-if="resumo" :to="`/fotografos/${resumo.conta.id}`" variante="secundaria"
            >Abrir completo →</UiBotao
          >
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>
