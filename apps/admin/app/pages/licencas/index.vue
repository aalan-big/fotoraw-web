<script setup lang="ts">
import type { Licenca, Paginado } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Licenças' });

const api = useApi();
const rota = useRoute();
const q = (k: string) => (typeof rota.query[k] === 'string' ? (rota.query[k] as string) : '');

const filtro = reactive({
  tipo: q('tipo'),
  status: q('status') || 'ATIVA',
  venceEmDias: q('venceEmDias'),
  pagina: 1,
});

const { data: lista, status } = await useAsyncData(
  'admin-licencas',
  () =>
    api<Paginado<Licenca>>('/admin/licencas', {
      query: {
        tipo: filtro.tipo || undefined,
        status: filtro.status || undefined,
        venceEmDias: filtro.venceEmDias || undefined,
        pagina: filtro.pagina,
        porPagina: 25,
      },
    }),
  {
    watch: [() => filtro.tipo, () => filtro.status, () => filtro.venceEmDias, () => filtro.pagina],
  },
);
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Licenças</h1>
        <p class="text-sm text-muted">{{ lista?.total ?? 0 }} licenças</p>
      </div>
      <UiBotao to="/licencas/emitir">Emitir licença</UiBotao>
    </div>

    <div class="card flex flex-wrap items-end gap-3 p-4">
      <label>
        <span class="rotulo">Tipo</span>
        <select v-model="filtro.tipo" class="campo w-40" @change="filtro.pagina = 1">
          <option value="">todos</option>
          <option value="TRIAL">Trial</option>
          <option value="ASSINATURA">Assinatura</option>
          <option value="CORTESIA">Cortesia</option>
          <option value="VITALICIA">Vitalícia</option>
        </select>
      </label>
      <label>
        <span class="rotulo">Status</span>
        <select v-model="filtro.status" class="campo w-40" @change="filtro.pagina = 1">
          <option value="">todos</option>
          <option value="ATIVA">Ativa</option>
          <option value="SUSPENSA">Suspensa</option>
          <option value="REVOGADA">Revogada</option>
          <option value="EXPIRADA">Expirada</option>
        </select>
      </label>
      <label>
        <span class="rotulo">Vence em</span>
        <select v-model="filtro.venceEmDias" class="campo w-40" @change="filtro.pagina = 1">
          <option value="">qualquer data</option>
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
        </select>
      </label>
    </div>

    <UiTabela
      :carregando="status === 'pending'"
      :vazio="lista && !lista.itens.length ? 'Nenhuma licença com esses filtros.' : undefined"
    >
      <template #cabecalho>
        <tr>
          <th class="px-4 py-2.5">Conta</th>
          <th class="px-4 py-2.5">Chave</th>
          <th class="px-4 py-2.5">Tipo</th>
          <th class="px-4 py-2.5">Status</th>
          <th class="px-4 py-2.5">Validade</th>
          <th class="px-4 py-2.5">Emitida</th>
        </tr>
      </template>
      <tr v-for="l in lista?.itens" :key="l.id" class="hover:bg-surface-2/60">
        <td class="px-4 py-2.5">
          <NuxtLink
            :to="`/fotografos/${l.contaId}`"
            class="block font-medium hover:text-wine-tint"
            >{{ l.conta?.nome }}</NuxtLink
          >
          <span class="block text-xs text-muted">@{{ l.conta?.slug }}</span>
        </td>
        <td class="px-4 py-2.5 font-mono text-xs">{{ l.chave }}</td>
        <td class="px-4 py-2.5">{{ rotuloTipoLicenca[l.tipo] }}</td>
        <td class="px-4 py-2.5">
          <UiEtiqueta :cor="corStatus[l.status]">{{ rotuloStatus[l.status] }}</UiEtiqueta>
        </td>
        <td class="px-4 py-2.5 text-xs">{{ l.validaAte ? data(l.validaAte) : 'não vence' }}</td>
        <td class="px-4 py-2.5 text-xs text-muted">{{ data(l.emitidaEm) }}</td>
      </tr>
    </UiTabela>

    <UiPaginacao
      v-if="lista"
      v-model:pagina="filtro.pagina"
      :por-pagina="lista.porPagina"
      :total="lista.total"
    />
  </div>
</template>
