<script setup lang="ts">
import type { ContaLista, Licenca, Paginado, Plano, RecursosLicenca } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Emitir licença' });

const api = useApi();
const rota = useRoute();

const { data: planos } = await useAsyncData('admin-planos', () => api<Plano[]>('/admin/planos'));

// --- conta ---
const busca = ref('');
const contas = ref<ContaLista[]>([]);
const conta = ref<ContaLista | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(busca, (v) => {
  clearTimeout(timer);
  if (v.trim().length < 2) {
    contas.value = [];
    return;
  }
  timer = setTimeout(async () => {
    const r = await api<Paginado<ContaLista>>('/admin/contas', {
      query: { q: v.trim(), porPagina: 8 },
    });
    contas.value = r.itens;
  }, 250);
});
// veio do detalhe do fotógrafo (?contaId=)
if (typeof rota.query.contaId === 'string') {
  const r = await api<Paginado<ContaLista>>('/admin/contas', { query: { porPagina: 100 } }).catch(
    () => null,
  );
  conta.value = r?.itens.find((c) => c.id === rota.query.contaId) ?? null;
}

// --- licença ---
const form = reactive({
  tipo: 'CORTESIA' as 'CORTESIA' | 'VITALICIA' | 'TRIAL',
  planoBaseId: '',
  validaAte: '',
  motivo: '',
});
watch(
  planos,
  (p) => {
    if (p && !form.planoBaseId)
      form.planoBaseId = p.find((x) => x.codigo === 'pro_mensal')?.id ?? p[0]?.id ?? '';
  },
  { immediate: true },
);
const planoBase = computed(() => planos.value?.find((p) => p.id === form.planoBaseId) ?? null);

/** Ajustes por cima do plano-base. Vazio = usa o do plano. */
const ajustes = reactive<{ [K in keyof RecursosLicenca]?: RecursosLicenca[K] }>({});
const recursosDoPlano = computed<RecursosLicenca | null>(() =>
  planoBase.value
    ? {
        limite_galerias_ativas: planoBase.value.limiteGaleriasAtivas,
        limite_fotos_por_galeria: planoBase.value.limiteFotosPorGaleria,
        limite_armazenamento_mb: planoBase.value.limiteArmazenamentoMb,
        limite_dispositivos: planoBase.value.limiteDispositivos,
        permite_evento: planoBase.value.permiteEvento,
        permite_ensaio: planoBase.value.permiteEnsaio,
        permite_galeria_privada: planoBase.value.permiteGaleriaPrivada,
        permite_gestao_estudio: planoBase.value.permiteGestaoEstudio,
      }
    : null,
);
const limites = [
  ['limite_galerias_ativas', 'Galerias ativas'],
  ['limite_fotos_por_galeria', 'Fotos por galeria'],
  ['limite_armazenamento_mb', 'Armazenamento (MB)'],
  ['limite_dispositivos', 'Máquinas'],
] as const;
const flags = [
  ['permite_evento', 'Vender evento'],
  ['permite_ensaio', 'Publicar ensaio'],
  ['permite_galeria_privada', 'Galeria privada com seleção'],
  ['permite_gestao_estudio', 'Gestão do estúdio no desktop'],
] as const;
function limiteAtual(k: (typeof limites)[number][0]) {
  return ajustes[k] !== undefined ? ajustes[k] : recursosDoPlano.value?.[k];
}
function setLimite(k: (typeof limites)[number][0], v: string) {
  if (v === '') delete ajustes[k];
  else ajustes[k] = v === 'inf' ? null : Number(v);
}
function flagAtual(k: (typeof flags)[number][0]) {
  return ajustes[k] !== undefined ? ajustes[k] : (recursosDoPlano.value?.[k] ?? false);
}

function atalho(dias: number) {
  const d = new Date(Date.now() + dias * 24 * 3600 * 1000);
  form.validaAte = d.toISOString().slice(0, 10);
}

const enviando = ref(false);
const erro = ref('');
const erros = ref<Record<string, string>>({});
const emitida = ref<{ licenca: Licenca; revogadas: number } | null>(null);

async function emitir() {
  if (!conta.value) {
    erro.value = 'Escolha a conta.';
    return;
  }
  enviando.value = true;
  erro.value = '';
  erros.value = {};
  try {
    emitida.value = await api<{ licenca: Licenca; revogadas: number }>('/admin/licencas', {
      method: 'POST',
      body: {
        contaId: conta.value.id,
        tipo: form.tipo,
        planoBaseId: form.planoBaseId,
        recursos: Object.keys(ajustes).length ? ajustes : undefined,
        validaAte:
          form.tipo === 'VITALICIA' || !form.validaAte
            ? undefined
            : new Date(`${form.validaAte}T23:59:59`).toISOString(),
        motivo: form.motivo,
      },
    });
  } catch (e) {
    const apiErro = lerErroApi(e);
    erros.value = errosPorCampo(apiErro);
    if (!apiErro.erros?.length) erro.value = apiErro.mensagem;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5">
    <NuxtLink to="/licencas" class="text-sm text-muted hover:text-text">← Licenças</NuxtLink>
    <div>
      <h1 class="text-2xl font-semibold">Emitir licença</h1>
      <p class="text-sm text-muted">
        A licença ativa da conta (se houver) é revogada e substituída por esta.
      </p>
    </div>

    <template v-if="emitida">
      <UiAlerta tipo="sucesso">
        Licença <strong class="font-mono">{{ emitida.licenca.chave }}</strong> emitida para
        {{ conta?.nome }}.
        <span v-if="emitida.revogadas">{{ emitida.revogadas }} anterior(es) revogada(s).</span>
        O desktop recebe na próxima abertura.
      </UiAlerta>
      <div class="flex gap-2">
        <UiBotao :to="`/fotografos/${conta?.id}`">Ver a conta</UiBotao>
        <UiBotao
          variante="secundaria"
          @click="
            emitida = null;
            conta = null;
            busca = '';
          "
          >Emitir outra</UiBotao
        >
      </div>
    </template>

    <form v-else class="space-y-5" @submit.prevent="emitir">
      <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>

      <UiCartao titulo="1. Conta">
        <div
          v-if="conta"
          class="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg/60 px-3 py-2"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">{{ conta.nome }}</p>
            <p class="truncate text-xs text-muted">
              @{{ conta.slug }} · {{ conta.email }} · hoje:
              {{ conta.plano === 'pro' ? 'PRO' : conta.plano }}
            </p>
          </div>
          <button
            type="button"
            class="text-xs text-wine-tint hover:underline"
            @click="conta = null"
          >
            trocar
          </button>
        </div>
        <div v-else>
          <input
            v-model="busca"
            class="campo"
            placeholder="buscar por nome, e-mail ou @slug"
            autofocus
          />
          <ul
            v-if="contas.length"
            class="mt-2 divide-y divide-border rounded-lg border border-border"
          >
            <li v-for="c in contas" :key="c.id">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2"
                @click="
                  conta = c;
                  contas = [];
                "
              >
                <span class="min-w-0"
                  ><span class="block truncate text-sm font-medium">{{ c.nome }}</span
                  ><span class="block truncate text-xs text-muted"
                    >@{{ c.slug }} · {{ c.email }}</span
                  ></span
                >
                <UiEtiqueta :cor="corPlano[c.plano]">{{
                  c.plano === 'pro' ? 'PRO' : c.plano
                }}</UiEtiqueta>
              </button>
            </li>
          </ul>
        </div>
      </UiCartao>

      <UiCartao titulo="2. Tipo e validade">
        <div class="grid gap-4 sm:grid-cols-2">
          <label>
            <span class="rotulo">Tipo</span>
            <select v-model="form.tipo" class="campo">
              <option value="CORTESIA">Cortesia (grátis, com validade)</option>
              <option value="TRIAL">Trial estendido</option>
              <option value="VITALICIA">Vitalícia (não vence)</option>
            </select>
          </label>
          <label>
            <span class="rotulo">Plano-base (limites)</span>
            <select v-model="form.planoBaseId" class="campo">
              <option v-for="p in planos" :key="p.id" :value="p.id">{{ p.nome }}</option>
            </select>
          </label>
          <div v-if="form.tipo !== 'VITALICIA'" class="sm:col-span-2">
            <UiCampo
              v-model="form.validaAte"
              rotulo="Válida até"
              type="date"
              required
              :erro="erros.validaAte"
            />
            <div class="mt-1.5 flex gap-2 text-xs">
              <button
                v-for="d in [30, 90, 180, 365]"
                :key="d"
                type="button"
                class="rounded-md border border-border px-2 py-0.5 text-muted hover:border-wine hover:text-wine-tint"
                @click="atalho(d)"
              >
                +{{ d }} dias
              </button>
            </div>
          </div>
        </div>
      </UiCartao>

      <UiCartao
        titulo="3. Recursos"
        descricao="Vêm do plano-base; mude só o que precisar. O desktop lê exatamente isto."
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <label v-for="[k, rotulo] in limites" :key="k">
            <span class="rotulo">{{ rotulo }}</span>
            <input
              :value="limiteAtual(k) === null ? 'inf' : (limiteAtual(k) ?? '')"
              class="campo"
              placeholder="inf = sem limite"
              @input="setLimite(k, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <label
            v-for="[k, rotulo] in flags"
            :key="k"
            class="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              class="size-4 accent-wine"
              :checked="flagAtual(k)"
              @change="ajustes[k] = ($event.target as HTMLInputElement).checked"
            />
            {{ rotulo }}
          </label>
        </div>
      </UiCartao>

      <UiCartao titulo="4. Motivo" descricao="Vai pra auditoria e aparece no histórico da conta.">
        <UiCampo
          v-model="form.motivo"
          rotulo="Motivo"
          required
          :erro="erros.motivo"
          placeholder="ex.: parceiro do lançamento — 6 meses grátis"
        />
      </UiCartao>

      <UiBotao type="submit" tamanho="lg" :disabled="enviando || !conta">{{
        enviando ? 'Emitindo…' : 'Emitir licença'
      }}</UiBotao>
    </form>
  </div>
</template>
