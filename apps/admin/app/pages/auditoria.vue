<script setup lang="ts">
import type { AcaoAuditoria, AuditoriaItem, Paginado } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Auditoria' });

const api = useApi();
const rota = useRoute();
const router = useRouter();
const q = (k: string) => (typeof rota.query[k] === 'string' ? (rota.query[k] as string) : '');

const filtro = reactive({
  ator: q('ator'),
  acao: q('acao'),
  alvoTipo: q('alvoTipo'),
  alvoId: q('alvoId'),
  de: q('de'),
  ate: q('ate'),
  pagina: Number(rota.query.pagina ?? 1) || 1,
});

const { data: acoes } = await useAsyncData('admin-auditoria-acoes', () =>
  api<AcaoAuditoria[]>('/admin/auditoria/acoes'),
);
/** ações agrupadas pelo prefixo (conta., licenca., …) pro select ficar legível */
const grupos = computed(() => {
  const g = new Map<string, AcaoAuditoria[]>();
  for (const a of acoes.value ?? []) {
    const chave = a.acao.split('.')[0]!;
    if (!g.has(chave)) g.set(chave, []);
    g.get(chave)!.push(a);
  }
  return [...g.entries()];
});
const alvoTipos = computed(() => [
  ...new Set((acoes.value ?? []).map((a) => a.acao.split('.')[0]!)),
]);

const { data: lista, status } = await useAsyncData(
  'admin-auditoria',
  () =>
    api<Paginado<AuditoriaItem>>('/admin/auditoria', {
      query: {
        ator: filtro.ator || undefined,
        acao: filtro.acao || undefined,
        alvoTipo: filtro.alvoTipo || undefined,
        alvoId: filtro.alvoId || undefined,
        de: filtro.de || undefined,
        ate: filtro.ate || undefined,
        pagina: filtro.pagina,
        porPagina: 50,
      },
    }),
  {
    watch: [
      () => filtro.ator,
      () => filtro.acao,
      () => filtro.alvoTipo,
      () => filtro.de,
      () => filtro.ate,
      () => filtro.pagina,
    ],
  },
);
watch(
  () => ({ ...filtro }),
  (f) =>
    router.replace({
      query: Object.fromEntries(
        Object.entries(f).filter(([k, v]) => v && !(k === 'pagina' && v === 1)),
      ),
    }),
);
function limpar() {
  Object.assign(filtro, {
    ator: '',
    acao: '',
    alvoTipo: '',
    alvoId: '',
    de: '',
    ate: '',
    pagina: 1,
  });
}

const aberto = ref<string | null>(null);
const json = (v: unknown) => (v == null ? '—' : JSON.stringify(v, null, 2));
const linkDoAlvo = (a: AuditoriaItem) => {
  if (a.alvoTipo === 'conta') return `/fotografos/${a.alvoId}`;
  if (a.alvoTipo === 'assinatura') return `/assinaturas/${a.alvoId}`;
  if (a.alvoTipo === 'plano') return '/planos';
  if (a.alvoTipo === 'configuracao') return '/configuracoes';
  if (a.alvoTipo === 'repasse') return '/financeiro/repasses';
  return null;
};
const corAtor = (a: AuditoriaItem) =>
  !a.ator
    ? 'bg-surface-2 text-muted'
    : a.ator.papel === 'ADMIN'
      ? 'bg-wine-dim text-wine-tint'
      : 'bg-info/15 text-info';
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Auditoria</h1>
      <p class="text-sm text-muted">
        Tudo que mudou na plataforma: quem fez, o quê, quando e o antes/depois.
        {{ lista ? `${lista.total} registro(s) com esses filtros.` : '' }}
      </p>
    </div>

    <div class="card flex flex-wrap items-end gap-3 p-4">
      <label>
        <span class="rotulo">Quem</span>
        <select v-model="filtro.ator" class="campo w-36" @change="filtro.pagina = 1">
          <option value="">todos</option>
          <option value="admin">admin</option>
          <option value="fotografo">fotógrafo</option>
          <option value="sistema">sistema</option>
        </select>
      </label>
      <label>
        <span class="rotulo">Ação</span>
        <select v-model="filtro.acao" class="campo w-64" @change="filtro.pagina = 1">
          <option value="">todas</option>
          <optgroup v-for="[grupo, itens] in grupos" :key="grupo" :label="grupo">
            <option :value="`${grupo}.`">todas de {{ grupo }}</option>
            <option v-for="a in itens" :key="a.acao" :value="a.acao">
              {{ a.rotulo }} ({{ a.total }})
            </option>
          </optgroup>
        </select>
      </label>
      <label>
        <span class="rotulo">Alvo</span>
        <select v-model="filtro.alvoTipo" class="campo w-36" @change="filtro.pagina = 1">
          <option value="">qualquer</option>
          <option v-for="t in alvoTipos" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label>
        <span class="rotulo">De</span>
        <input v-model="filtro.de" type="date" class="campo w-38" @change="filtro.pagina = 1" />
      </label>
      <label>
        <span class="rotulo">Até</span>
        <input v-model="filtro.ate" type="date" class="campo w-38" @change="filtro.pagina = 1" />
      </label>
      <button
        v-if="filtro.alvoId"
        type="button"
        class="text-xs text-muted hover:text-text"
        @click="filtro.alvoId = ''"
      >
        alvo <span class="font-mono">{{ filtro.alvoId.slice(0, 8) }}…</span> ×
      </button>
      <UiBotao variante="fantasma" @click="limpar">Limpar</UiBotao>
    </div>

    <UiTabela
      :carregando="status === 'pending'"
      :vazio="lista && !lista.itens.length ? 'Nada registrado com esses filtros.' : undefined"
    >
      <template #cabecalho>
        <tr>
          <th class="px-4 py-2.5">Quando</th>
          <th class="px-4 py-2.5">O quê</th>
          <th class="px-4 py-2.5">Quem</th>
          <th class="px-4 py-2.5">Alvo</th>
          <th class="px-4 py-2.5">IP</th>
          <th class="px-4 py-2.5"></th>
        </tr>
      </template>
      <template v-for="a in lista?.itens" :key="a.id">
        <tr
          class="cursor-pointer hover:bg-surface-2/60"
          @click="aberto = aberto === a.id ? null : a.id"
        >
          <td class="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
            {{ dataHora(a.criadoEm) }}
          </td>
          <td class="px-4 py-2.5">
            <span class="block">{{ a.rotulo }}</span>
            <span class="block font-mono text-[11px] text-muted">{{ a.acao }}</span>
          </td>
          <td class="px-4 py-2.5">
            <UiEtiqueta :cor="corAtor(a)">
              {{ a.ator ? (a.ator.papel === 'ADMIN' ? 'admin' : 'fotógrafo') : 'sistema' }}
            </UiEtiqueta>
            <span v-if="a.ator" class="ml-1 text-xs">{{ a.ator.nome }}</span>
          </td>
          <td class="px-4 py-2.5 text-xs">
            <NuxtLink
              v-if="linkDoAlvo(a)"
              :to="linkDoAlvo(a)!"
              class="text-wine-tint hover:underline"
              @click.stop
            >
              {{ a.alvoConta ? a.alvoConta.nome : a.alvoTipo }}
            </NuxtLink>
            <span v-else>{{ a.alvoTipo }}</span>
            <button
              type="button"
              class="ml-1 font-mono text-[11px] text-muted hover:text-text"
              title="filtrar por este alvo"
              @click.stop="
                filtro.alvoId = a.alvoId;
                filtro.pagina = 1;
              "
            >
              {{ a.alvoId.slice(0, 8) }}
            </button>
          </td>
          <td class="px-4 py-2.5 font-mono text-[11px] text-muted">{{ a.ip ?? '—' }}</td>
          <td class="px-4 py-2.5 text-right text-xs text-muted">
            {{ aberto === a.id ? '▲' : '▼' }}
          </td>
        </tr>
        <tr v-if="aberto === a.id">
          <td colspan="6" class="bg-bg/60 px-4 py-3">
            <div class="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p class="rotulo">Antes</p>
                <pre
                  class="overflow-x-auto rounded-md border border-border bg-surface p-2 font-mono text-[11px] text-muted"
                  >{{ json(a.antes) }}</pre>
              </div>
              <div>
                <p class="rotulo">Depois</p>
                <pre
                  class="overflow-x-auto rounded-md border border-border bg-surface p-2 font-mono text-[11px]"
                  >{{ json(a.depois) }}</pre>
              </div>
            </div>
            <p class="mt-2 font-mono text-[11px] text-muted">
              id {{ a.id }} · alvo {{ a.alvoTipo }}/{{ a.alvoId
              }}<span v-if="a.ator"> · ator {{ a.ator.email }}</span>
            </p>
          </td>
        </tr>
      </template>
    </UiTabela>

    <UiPaginacao
      v-if="lista"
      v-model:pagina="filtro.pagina"
      :por-pagina="lista.porPagina"
      :total="lista.total"
    />
  </div>
</template>
