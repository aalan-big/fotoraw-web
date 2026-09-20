<script setup lang="ts">
import type { Plano } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Planos' });

const api = useApi();
const { data: planos, refresh } = await useAsyncData('admin-planos', () =>
  api<Plano[]>('/admin/planos'),
);

const limites = [
  ['limiteGaleriasAtivas', 'Galerias ativas'],
  ['limiteFotosPorGaleria', 'Fotos por galeria'],
  ['limiteArmazenamentoMb', 'Armazenamento (MB)'],
  ['limiteDispositivos', 'Máquinas'],
] as const;
const flags = [
  ['permiteEvento', 'Vender evento'],
  ['permiteEnsaio', 'Publicar ensaio'],
  ['permiteGaleriaPrivada', 'Galeria privada com seleção'],
  ['permiteGestaoEstudio', 'Gestão do estúdio no desktop'],
] as const;
type Limite = (typeof limites)[number][0];
type Flag = (typeof flags)[number][0];

const rotuloPeriodo: Record<Plano['periodicidade'], string> = {
  MENSAL: '/mês',
  ANUAL: '/ano',
  NENHUMA: '',
};
const semLimite = (v: number | null) => (v === null ? '∞' : v.toLocaleString('pt-BR'));

// --- edição inline ----------------------------------------------------------
interface Form {
  nome: string;
  preco: string;
  periodicidade: Plano['periodicidade'];
  comissao: string;
  limites: Record<Limite, string>;
  flags: Record<Flag, boolean>;
  ordem: string;
}
const editando = ref<string | null>(null);
const form = reactive<Form>({} as Form);
const salvando = ref(false);
const erro = ref('');
const erros = ref<Record<string, string>>({});
const aviso = ref('');

function abrir(p: Plano) {
  editando.value = p.id;
  erro.value = '';
  erros.value = {};
  aviso.value = '';
  form.nome = p.nome;
  form.preco = (p.precoCentavos / 100).toFixed(2).replace('.', ',');
  form.periodicidade = p.periodicidade;
  form.comissao = String(p.comissaoEventoPct).replace('.', ',');
  form.ordem = String(p.ordem);
  form.limites = {} as Form['limites'];
  for (const [k] of limites) form.limites[k] = p[k] === null ? '' : String(p[k]);
  form.flags = {} as Form['flags'];
  for (const [k] of flags) form.flags[k] = p[k];
}
const numero = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

/** Só manda o que mudou — a auditoria fica limpa. */
function diff(p: Plano): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  if (form.nome.trim() !== p.nome) d.nome = form.nome.trim();
  const preco = Math.round(numero(form.preco) * 100);
  if (preco !== p.precoCentavos) d.precoCentavos = preco;
  if (form.periodicidade !== p.periodicidade) d.periodicidade = form.periodicidade;
  const comissao = numero(form.comissao);
  if (comissao !== p.comissaoEventoPct) d.comissaoEventoPct = comissao;
  const ordem = Number(form.ordem);
  if (ordem !== p.ordem) d.ordem = ordem;
  for (const [k] of limites) {
    const v = form.limites[k].trim() === '' ? null : Number(form.limites[k]);
    if (v !== p[k]) d[k] = v;
  }
  for (const [k] of flags) if (form.flags[k] !== p[k]) d[k] = form.flags[k];
  return d;
}

async function salvar(p: Plano) {
  const dados = diff(p);
  if (!Object.keys(dados).length) {
    editando.value = null;
    return;
  }
  salvando.value = true;
  erro.value = '';
  erros.value = {};
  try {
    await api(`/admin/planos/${p.id}`, { method: 'PATCH', body: dados });
    await refresh();
    editando.value = null;
    const mudouLimites = Object.keys(dados).some(
      (k) => limites.some(([l]) => l === k) || flags.some(([f]) => f === k),
    );
    if (mudouLimites && p.licencasAtivas > 0) {
      aviso.value = `${p.nome}: limites mudaram, mas as ${p.licencasAtivas} licenças ativas continuam com os antigos até você reemitir.`;
    }
  } catch (e) {
    const apiErro = lerErroApi(e);
    erros.value = errosPorCampo(apiErro);
    if (!apiErro.erros?.length) erro.value = apiErro.mensagem;
  } finally {
    salvando.value = false;
  }
}

async function alternarAtivo(p: Plano) {
  await api(`/admin/planos/${p.id}`, { method: 'PATCH', body: { ativo: !p.ativo } });
  await refresh();
}

// --- reemitir ----------------------------------------------------------------
const reemitindo = ref<string | null>(null);
const motivoReemissao = ref('');
const resultadoReemissao = ref('');
async function reemitir(p: Plano) {
  salvando.value = true;
  erro.value = '';
  try {
    const r = await api<{ atualizadas: number }>(`/admin/planos/${p.id}/reemitir`, {
      method: 'POST',
      body: { motivo: motivoReemissao.value },
    });
    resultadoReemissao.value = `${r.atualizadas} licença(s) do ${p.nome} atualizada(s). O desktop recebe na próxima abertura.`;
    reemitindo.value = null;
    motivoReemissao.value = '';
    aviso.value = '';
    await refresh();
  } catch (e) {
    erro.value = lerErroApi(e).mensagem;
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Planos</h1>
      <p class="text-sm text-muted">
        Mudar um plano não mexe em licença já emitida (é snapshot). Use <em>Reemitir</em> pra
        aplicar os limites novos nas ativas.
      </p>
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>
    <UiAlerta v-if="aviso" tipo="aviso">{{ aviso }}</UiAlerta>
    <UiAlerta v-if="resultadoReemissao" tipo="sucesso">{{ resultadoReemissao }}</UiAlerta>

    <UiCartao v-for="p in planos" :key="p.id" :class="{ 'opacity-60': !p.ativo }">
      <!-- cabeçalho do plano -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold">{{ p.nome }}</h2>
            <span class="font-mono text-xs text-muted">{{ p.codigo }}</span>
            <UiEtiqueta v-if="!p.ativo" cor="bg-surface-2 text-muted">fora de venda</UiEtiqueta>
          </div>
          <p class="mt-0.5 text-sm text-muted">
            <strong class="text-text">{{ dinheiro(p.precoCentavos) }}</strong
            >{{ rotuloPeriodo[p.periodicidade] }} · comissão {{ p.comissaoEventoPct }}% no evento ·
            {{ p.licencasAtivas }} licença(s) ativa(s)
          </p>
        </div>
        <div v-if="editando !== p.id" class="flex gap-2">
          <UiBotao v-if="p.codigo !== 'gratuito'" variante="secundaria" @click="alternarAtivo(p)">
            {{ p.ativo ? 'Tirar de venda' : 'Voltar a vender' }}
          </UiBotao>
          <UiBotao
            v-if="p.licencasAtivas"
            variante="secundaria"
            @click="
              reemitindo = reemitindo === p.id ? null : p.id;
              resultadoReemissao = '';
            "
          >
            Reemitir ({{ p.licencasAtivas }})
          </UiBotao>
          <UiBotao @click="abrir(p)">Editar</UiBotao>
        </div>
      </div>

      <!-- reemitir -->
      <form
        v-if="reemitindo === p.id"
        class="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3"
        @submit.prevent="reemitir(p)"
      >
        <div class="min-w-64 flex-1">
          <UiCampo
            v-model="motivoReemissao"
            rotulo="Motivo (vai pra auditoria)"
            placeholder="ex.: mais máquinas pra todo mundo"
            required
          />
        </div>
        <UiBotao type="submit" :disabled="salvando || motivoReemissao.trim().length < 3">
          Aplicar nas {{ p.licencasAtivas }} ativas
        </UiBotao>
        <UiBotao variante="fantasma" @click="reemitindo = null">Cancelar</UiBotao>
      </form>

      <!-- leitura -->
      <template v-if="editando !== p.id">
        <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div v-for="[k, rotulo] in limites" :key="k">
            <dt class="text-xs uppercase tracking-wide text-muted">{{ rotulo }}</dt>
            <dd class="font-medium">{{ semLimite(p[k]) }}</dd>
          </div>
        </dl>
        <div class="mt-3 flex flex-wrap gap-2">
          <UiEtiqueta
            v-for="[k, rotulo] in flags"
            :key="k"
            :cor="p[k] ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted line-through'"
          >
            {{ rotulo }}
          </UiEtiqueta>
        </div>
      </template>

      <!-- edição -->
      <form v-else class="mt-4 space-y-4" @submit.prevent="salvar(p)">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UiCampo v-model="form.nome" rotulo="Nome" required :erro="erros.nome" />
          <UiCampo
            v-model="form.preco"
            rotulo="Preço (R$)"
            inputmode="decimal"
            :erro="erros.precoCentavos"
          />
          <label>
            <span class="rotulo">Cobrança</span>
            <select v-model="form.periodicidade" class="campo">
              <option value="NENHUMA">sem cobrança</option>
              <option value="MENSAL">mensal</option>
              <option value="ANUAL">anual</option>
            </select>
          </label>
          <UiCampo
            v-model="form.comissao"
            rotulo="Comissão no evento (%)"
            inputmode="decimal"
            :erro="erros.comissaoEventoPct"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <UiCampo
            v-for="[k, rotulo] in limites"
            :key="k"
            v-model="form.limites[k]"
            :rotulo="rotulo"
            inputmode="numeric"
            placeholder="vazio = sem limite"
            :erro="erros[k]"
          />
          <UiCampo v-model="form.ordem" rotulo="Ordem" inputmode="numeric" :erro="erros.ordem" />
        </div>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label
            v-for="[k, rotulo] in flags"
            :key="k"
            class="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <input v-model="form.flags[k]" type="checkbox" class="size-4 accent-wine" />
            {{ rotulo }}
          </label>
        </div>
        <div class="flex gap-2">
          <UiBotao type="submit" :disabled="salvando">{{
            salvando ? 'Salvando…' : 'Salvar'
          }}</UiBotao>
          <UiBotao variante="fantasma" @click="editando = null">Cancelar</UiBotao>
        </div>
      </form>
    </UiCartao>
  </div>
</template>
