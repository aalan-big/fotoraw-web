<script setup lang="ts">
import type { Licenca } from '~/types/api';

/**
 * Ações de uma licença sem sair da lista: dar mais dias (trial/cortesia),
 * suspender, reativar, revogar. `licenca = null` fecha. Tudo vai pra auditoria
 * com o motivo digitado aqui.
 */
const props = defineProps<{ licenca: Licenca | null }>();
/** `alterado` traz a licença como o servidor devolveu (sem `conta`) */
const emit = defineEmits<{ fechar: []; alterado: [licenca: Licenca] }>();

const api = useApi();
const DIA_MS = 24 * 60 * 60 * 1000;

const l = computed(() => props.licenca);
const motivo = ref('');
const dias = ref<number | null>(30);
const diasOutro = ref('');
const ocupado = ref(false);
const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

watch(
  () => props.licenca?.id,
  () => {
    motivo.value = '';
    dias.value = 30;
    diasOutro.value = '';
    msg.value = null;
  },
);

// o servidor só marca EXPIRADA quando a conta consulta; aqui já mostra vencida
const vencida = computed(
  () => !!l.value?.validaAte && new Date(l.value.validaAte).getTime() < Date.now(),
);
const situacao = computed(() => {
  if (!l.value?.validaAte) return 'não vence';
  const d = Math.ceil((new Date(l.value.validaAte).getTime() - Date.now()) / DIA_MS);
  if (d > 1) return `faltam ${d} dias`;
  if (d === 1) return 'vence amanhã';
  if (d === 0) return 'vence hoje';
  return `venceu há ${-d} ${d === -1 ? 'dia' : 'dias'}`;
});

const podeEstender = computed(
  () =>
    !!l.value &&
    (l.value.tipo === 'TRIAL' || l.value.tipo === 'CORTESIA') &&
    l.value.status !== 'REVOGADA',
);
const diasEscolhidos = computed(() => {
  if (dias.value !== null) return dias.value;
  const n = Number.parseInt(diasOutro.value, 10);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
});
const novaValidade = computed(() => {
  if (!l.value || !diasEscolhidos.value) return null;
  const base = Math.max(Date.now(), l.value.validaAte ? new Date(l.value.validaAte).getTime() : 0);
  return new Date(base + diasEscolhidos.value * DIA_MS).toISOString();
});
const motivoOk = computed(() => motivo.value.trim().length >= 3);

async function agir(fn: () => Promise<Licenca>, ok: string) {
  ocupado.value = true;
  msg.value = null;
  try {
    const nova = await fn();
    msg.value = { tipo: 'sucesso', texto: ok };
    motivo.value = '';
    emit('alterado', nova);
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
  }
}

function estender() {
  if (!l.value || !diasEscolhidos.value) return;
  const n = diasEscolhidos.value;
  return agir(
    () =>
      api<Licenca>(`/admin/licencas/${l.value!.id}/validade`, {
        method: 'PATCH',
        body: { dias: n, motivo: motivo.value },
      }),
    `+${n} dias. Nova validade: ${data(novaValidade.value)}.`,
  );
}

function mudarStatus(status: 'ATIVA' | 'SUSPENSA' | 'REVOGADA') {
  if (!l.value) return;
  if (
    status === 'REVOGADA' &&
    !confirm(`Revogar ${l.value.chave}? É definitivo — a conta cai no gratuito.`)
  )
    return;
  return agir(
    () =>
      api<Licenca>(`/admin/licencas/${l.value!.id}/status`, {
        method: 'PATCH',
        body: { status, motivo: motivo.value },
      }),
    `Licença ${rotuloStatus[status]!.toLowerCase()}.`,
  );
}

function tecla(e: KeyboardEvent) {
  if (props.licenca && e.key === 'Escape') emit('fechar');
}
onMounted(() => document.addEventListener('keydown', tecla));
onBeforeUnmount(() => document.removeEventListener('keydown', tecla));

const opcoesDias = [7, 14, 30, 90];
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
        v-if="l"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
        @click.self="emit('fechar')"
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-label="`Licença ${l.chave}`"
          class="w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl shadow-black/60"
        >
          <!-- topo -->
          <header class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div class="min-w-0">
              <h2 class="truncate text-lg font-semibold">{{ l.conta?.nome }}</h2>
              <p class="text-xs text-muted">
                @{{ l.conta?.slug }} · <span class="font-mono">{{ l.chave }}</span>
              </p>
            </div>
            <button
              type="button"
              class="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Fechar"
              @click="emit('fechar')"
            >
              <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="space-y-5 px-5 py-4">
            <!-- situação -->
            <dl class="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt class="rotulo">Tipo</dt>
                <dd>{{ rotuloTipoLicenca[l.tipo] }}</dd>
              </div>
              <div>
                <dt class="rotulo">Status</dt>
                <dd>
                  <UiEtiqueta v-if="vencida && l.status === 'ATIVA'" :cor="corStatus.VENCIDA">
                    Vencida
                  </UiEtiqueta>
                  <UiEtiqueta v-else :cor="corStatus[l.status]">{{ rotuloStatus[l.status] }}</UiEtiqueta>
                </dd>
              </div>
              <div>
                <dt class="rotulo">Validade</dt>
                <dd>{{ l.validaAte ? data(l.validaAte) : '—' }}</dd>
                <dd class="text-xs" :class="vencida ? 'text-danger' : 'text-muted'">{{ situacao }}</dd>
              </div>
            </dl>

            <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

            <UiCampo
              v-model="motivo"
              rotulo="Motivo (vai pra auditoria)"
              placeholder="ex.: fotógrafo testador"
              :maxlength="300"
            />

            <!-- dar mais dias -->
            <section v-if="podeEstender" class="space-y-3">
              <h3 class="text-sm font-semibold">Dar mais dias</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="n in opcoesDias"
                  :key="n"
                  type="button"
                  class="h-9 rounded-lg border px-3 text-sm font-medium transition-colors"
                  :class="
                    dias === n
                      ? 'border-wine bg-wine-dim text-wine-tint'
                      : 'border-border hover:border-muted/40'
                  "
                  @click="dias = n"
                >
                  +{{ n }} dias
                </button>
                <input
                  v-model="diasOutro"
                  type="number"
                  min="1"
                  max="365"
                  inputmode="numeric"
                  placeholder="outro"
                  class="campo h-9 w-24"
                  :class="{ 'border-wine': dias === null }"
                  @focus="dias = null"
                />
              </div>
              <p class="text-xs text-muted">
                <template v-if="novaValidade">
                  Nova validade: <strong class="text-text">{{ data(novaValidade) }}</strong>
                  <span v-if="vencida"> (conta a partir de hoje)</span>
                  <span v-if="l.status === 'EXPIRADA'"> · volta a valer</span>
                </template>
                <template v-else>Escolha de 1 a 365 dias.</template>
              </p>
              <UiBotao :disabled="ocupado || !motivoOk || !diasEscolhidos" @click="estender">
                Liberar {{ diasEscolhidos ? `+${diasEscolhidos} dias` : '' }}
              </UiBotao>
            </section>

            <UiAlerta v-else-if="l.tipo === 'ASSINATURA'" tipo="info">
              A validade desta licença segue os pagamentos da assinatura. Pra dar dias grátis:
              cancele a assinatura (o Mercado Pago para de cobrar) e emita uma cortesia.
              <NuxtLink
                v-if="l.assinaturaId"
                :to="`/assinaturas/${l.assinaturaId}`"
                class="mt-1 block font-medium underline"
                >Abrir a assinatura →</NuxtLink
              >
            </UiAlerta>

            <!-- status -->
            <section v-if="l.status === 'ATIVA' || l.status === 'SUSPENSA'" class="space-y-2">
              <h3 class="text-sm font-semibold">Situação</h3>
              <div class="flex flex-wrap gap-2">
                <UiBotao
                  v-if="l.status === 'ATIVA'"
                  variante="secundaria"
                  :disabled="ocupado || !motivoOk"
                  @click="mudarStatus('SUSPENSA')"
                  >Suspender</UiBotao
                >
                <UiBotao
                  v-else
                  variante="secundaria"
                  :disabled="ocupado || !motivoOk"
                  @click="mudarStatus('ATIVA')"
                  >Reativar</UiBotao
                >
                <UiBotao
                  variante="fantasma"
                  class="text-danger!"
                  :disabled="ocupado || !motivoOk"
                  @click="mudarStatus('REVOGADA')"
                  >Revogar</UiBotao
                >
              </div>
              <p class="text-xs text-muted">
                Suspensa ou revogada, o desktop e o painel caem pro gratuito na próxima consulta.
              </p>
            </section>
          </div>

          <footer
            class="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm"
          >
            <NuxtLink :to="`/fotografos/${l.contaId}`" class="text-muted hover:text-text">
              Abrir fotógrafo →
            </NuxtLink>
            <NuxtLink
              :to="`/licencas/emitir?contaId=${l.contaId}`"
              class="font-medium text-wine-tint hover:underline"
            >
              Trocar por cortesia ou vitalícia
            </NuxtLink>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
