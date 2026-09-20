<script setup lang="ts">
import type { AssinaturaDetalhe, ContaLista, Paginado, Plano } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Nova assinatura' });

const api = useApi();
const rota = useRoute();

const { data: planos } = await useAsyncData('admin-planos', () => api<Plano[]>('/admin/planos'));
const planosCobraveis = computed(
  () => planos.value?.filter((p) => p.ativo && p.periodicidade !== 'NENHUMA') ?? [],
);

// --- conta (mesmo padrão de /licencas/emitir) ---
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
if (typeof rota.query.contaId === 'string') {
  const r = await api<Paginado<ContaLista>>('/admin/contas', { query: { porPagina: 100 } }).catch(
    () => null,
  );
  conta.value = r?.itens.find((c) => c.id === rota.query.contaId) ?? null;
}

const hoje = new Date();
const form = reactive({
  planoId: '',
  inicioEm: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`,
  jaPaga: true,
  observacao: '',
});
watch(
  planosCobraveis,
  (p) => {
    if (p.length && !form.planoId)
      form.planoId = p.find((x) => x.codigo === 'pro_mensal')?.id ?? p[0]!.id;
  },
  { immediate: true },
);
const plano = computed(() => planosCobraveis.value.find((p) => p.id === form.planoId) ?? null);
const fimDoPeriodo = computed(() => {
  if (!plano.value || !form.inicioEm) return null;
  const d = new Date(`${form.inicioEm}T00:00:00`);
  if (plano.value.periodicidade === 'ANUAL') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
});

const enviando = ref(false);
const erro = ref('');
const erros = ref<Record<string, string>>({});
const criada = ref<AssinaturaDetalhe | null>(null);

async function criar() {
  if (!conta.value) {
    erro.value = 'Escolha a conta.';
    return;
  }
  enviando.value = true;
  erro.value = '';
  erros.value = {};
  try {
    criada.value = await api<AssinaturaDetalhe>('/admin/assinaturas', {
      method: 'POST',
      body: {
        contaId: conta.value.id,
        planoId: form.planoId,
        inicioEm: form.inicioEm,
        jaPaga: form.jaPaga,
        observacao: form.observacao || undefined,
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
    <NuxtLink to="/assinaturas" class="text-sm text-muted hover:text-text">← Assinaturas</NuxtLink>
    <div>
      <h1 class="text-2xl font-semibold">Nova assinatura manual</h1>
      <p class="text-sm text-muted">
        Pra quem paga por Pix ou transferência. A 1ª fatura nasce junto; marcada paga, a licença PRO
        vale até o fim do período e a próxima fatura já fica pendente.
      </p>
    </div>

    <template v-if="criada">
      <UiAlerta tipo="sucesso">
        Assinatura de <strong>{{ criada.conta.nome }}</strong> criada
        <template v-if="criada.licencas.length"
          >— licença <span class="font-mono">{{ criada.licencas[0]!.chave }}</span> ativa até
          {{ dataDia(criada.periodoAtualFim) }}.</template
        >
        <template v-else>— aguardando o pagamento da 1ª fatura pra liberar o PRO.</template>
      </UiAlerta>
      <div class="flex gap-2">
        <UiBotao :to="`/assinaturas/${criada.id}`">Ver a assinatura</UiBotao>
        <UiBotao :to="`/fotografos/${criada.conta.id}`" variante="secundaria">Ver a conta</UiBotao>
      </div>
    </template>

    <form v-else class="space-y-5" @submit.prevent="criar">
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

      <UiCartao titulo="2. Plano e período">
        <div class="grid gap-4 sm:grid-cols-2">
          <label>
            <span class="rotulo">Plano</span>
            <select v-model="form.planoId" class="campo">
              <option v-for="p in planosCobraveis" :key="p.id" :value="p.id">
                {{ p.nome }} — {{ dinheiro(p.precoCentavos)
                }}{{ p.periodicidade === 'ANUAL' ? '/ano' : '/mês' }}
              </option>
            </select>
          </label>
          <UiCampo
            v-model="form.inicioEm"
            rotulo="Início do período"
            type="date"
            required
            :erro="erros.inicioEm"
            :ajuda="
              fimDoPeriodo ? `vale até ${fimDoPeriodo.toLocaleDateString('pt-BR')}` : undefined
            "
          />
        </div>
        <label
          class="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-sm"
        >
          <input v-model="form.jaPaga" type="checkbox" class="mt-0.5 size-4 accent-wine" />
          <span>
            <span class="block font-medium">Já recebi o pagamento</span>
            <span class="block text-xs text-muted"
              >Marca a 1ª fatura como paga agora e libera o PRO na hora. Desmarcado, a fatura fica
              pendente e você marca quando o Pix cair.</span
            >
          </span>
        </label>
      </UiCartao>

      <UiCartao
        titulo="3. Observação"
        descricao="Opcional — chave Pix usada, combinado com o fotógrafo, etc."
      >
        <UiCampo v-model="form.observacao" rotulo="Observação" :linhas="2" :maxlength="500" />
      </UiCartao>

      <div class="flex gap-2">
        <UiBotao type="submit" tamanho="lg" :disabled="enviando || !conta || !form.planoId">
          {{ enviando ? 'Criando…' : 'Criar assinatura' }}
        </UiBotao>
        <UiBotao to="/assinaturas" variante="fantasma" tamanho="lg">Cancelar</UiBotao>
      </div>
    </form>
  </div>
</template>
