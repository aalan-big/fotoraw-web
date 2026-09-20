<script setup lang="ts">
import type { Configuracao } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Configurações' });

const api = useApi();
const { data: lista, refresh } = await useAsyncData('admin-configuracoes', () =>
  api<Configuracao[]>('/admin/configuracoes'),
);

const grupos: { chave: Configuracao['grupo']; titulo: string; descricao: string }[] = [
  { chave: 'licencas', titulo: 'Licenças', descricao: 'O que a conta ganha ao se cadastrar.' },
  { chave: 'vendas', titulo: 'Vendas', descricao: 'Comissão e prazos do checkout.' },
  {
    chave: 'downloads',
    titulo: 'Downloads',
    descricao: 'Quanto tempo e quantas vezes o comprador baixa.',
  },
  {
    chave: 'contato',
    titulo: 'Contato',
    descricao: 'E-mails que aparecem pra fotógrafo e cliente.',
  },
];
const doGrupo = (g: Configuracao['grupo']) => lista.value?.filter((c) => c.grupo === g) ?? [];

/** Rascunho por chave (string, como no input). Só existe enquanto difere do salvo. */
const rascunho = reactive<Record<string, string>>({});
const salvando = ref<string | null>(null);
const erros = reactive<Record<string, string>>({});
const salvo = ref<string | null>(null);

/** como o valor aparece no input: número com vírgula, e-mail como está */
const texto = (c: Configuracao) =>
  c.tipo === 'email' ? String(c.valor) : String(c.valor).replace('.', ',');
function editar(c: Configuracao, v: string) {
  if (v === texto(c)) delete rascunho[c.chave];
  else rascunho[c.chave] = v;
  delete erros[c.chave];
}
function valorPraApi(c: Configuracao, v: string): number | string {
  if (c.tipo === 'email') return v.trim();
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : v; // deixa o server explicar o erro
}

async function salvar(c: Configuracao) {
  const v = rascunho[c.chave];
  if (v === undefined) return;
  salvando.value = c.chave;
  delete erros[c.chave];
  try {
    await api(`/admin/configuracoes/${c.chave}`, {
      method: 'PUT',
      body: { valor: valorPraApi(c, v) },
    });
    delete rascunho[c.chave];
    await refresh();
    salvo.value = c.chave;
    setTimeout(() => (salvo.value = null), 2500);
  } catch (e) {
    const apiErro = lerErroApi(e);
    erros[c.chave] = errosPorCampo(apiErro).valor ?? apiErro.mensagem;
  } finally {
    salvando.value = null;
  }
}
function restaurarPadrao(c: Configuracao) {
  editar(c, c.tipo === 'email' ? String(c.padrao) : String(c.padrao).replace('.', ','));
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Configurações</h1>
      <p class="text-sm text-muted">Valem na hora, sem deploy. Cada alteração vai pra auditoria.</p>
    </div>

    <UiCartao v-for="g in grupos" :key="g.chave" :titulo="g.titulo" :descricao="g.descricao">
      <div class="divide-y divide-border">
        <div
          v-for="c in doGrupo(g.chave)"
          :key="c.chave"
          class="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-start"
        >
          <div class="min-w-0">
            <label :for="c.chave" class="block text-sm font-medium">{{ c.rotulo }}</label>
            <p class="text-xs text-muted">{{ c.descricao }}</p>
            <p class="mt-1 text-[11px] text-muted/80">
              <span class="font-mono">{{ c.chave }}</span>
              · padrão {{ c.padrao }}
              <button
                v-if="String(c.valor) !== String(c.padrao) || rascunho[c.chave] !== undefined"
                type="button"
                class="ml-1 text-wine-tint hover:underline"
                @click="restaurarPadrao(c)"
              >
                restaurar
              </button>
              <span v-if="c.atualizadoEm"> · alterado em {{ dataHora(c.atualizadoEm) }}</span>
            </p>
            <p v-if="erros[c.chave]" class="mt-1 text-xs text-danger">{{ erros[c.chave] }}</p>
          </div>
          <form class="flex items-center gap-2" @submit.prevent="salvar(c)">
            <div class="relative">
              <input
                :id="c.chave"
                :value="rascunho[c.chave] ?? texto(c)"
                class="campo"
                :class="[
                  c.tipo === 'email' ? 'w-64' : 'w-28 pr-8 text-right',
                  { 'border-danger': erros[c.chave] },
                ]"
                :type="c.tipo === 'email' ? 'email' : 'text'"
                :inputmode="c.tipo === 'email' ? 'email' : 'decimal'"
                @input="editar(c, ($event.target as HTMLInputElement).value)"
              />
              <span
                v-if="c.tipo === 'percentual'"
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted"
                >%</span
              >
            </div>
            <UiBotao
              v-if="rascunho[c.chave] !== undefined"
              type="submit"
              :disabled="salvando === c.chave"
            >
              {{ salvando === c.chave ? '…' : 'Salvar' }}
            </UiBotao>
            <span v-else-if="salvo === c.chave" class="text-xs text-success">salvo</span>
          </form>
        </div>
      </div>
    </UiCartao>
  </div>
</template>
