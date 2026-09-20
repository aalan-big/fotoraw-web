<script setup lang="ts">
import type { ContaLista, Paginado } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Fotógrafos' });

const api = useApi();
const rota = useRoute();
const router = useRouter();

const filtro = reactive({
  q: typeof rota.query.q === 'string' ? rota.query.q : '',
  status: typeof rota.query.status === 'string' ? rota.query.status : '',
  plano: typeof rota.query.plano === 'string' ? rota.query.plano : '',
  pagina: Number(rota.query.pagina ?? 1) || 1,
});

const {
  data: lista,
  status,
  refresh,
} = await useAsyncData(
  'admin-contas',
  () =>
    api<Paginado<ContaLista>>('/admin/contas', {
      query: {
        q: filtro.q || undefined,
        status: filtro.status || undefined,
        plano: filtro.plano || undefined,
        pagina: filtro.pagina,
        porPagina: 25,
      },
    }),
  { watch: [() => filtro.status, () => filtro.plano, () => filtro.pagina] },
);

watch(
  () => [filtro.q, filtro.status, filtro.plano, filtro.pagina],
  () =>
    router.replace({
      query: {
        ...(filtro.q && { q: filtro.q }),
        ...(filtro.status && { status: filtro.status }),
        ...(filtro.plano && { plano: filtro.plano }),
        ...(filtro.pagina > 1 && { pagina: filtro.pagina }),
      },
    }),
);
function buscar() {
  filtro.pagina = 1;
  refresh();
}

// --- painel 360 (drawer) ----------------------------------------------------
const contaAberta = ref<string | null>(
  typeof rota.query.conta === 'string' ? rota.query.conta : null,
);
watch(contaAberta, (id) => router.replace({ query: { ...rota.query, conta: id ?? undefined } }));
function navegar(direcao: -1 | 1) {
  const itens = lista.value?.itens ?? [];
  const i = itens.findIndex((c) => c.id === contaAberta.value);
  const alvo = itens[i + direcao];
  if (alvo) contaAberta.value = alvo.id;
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Fotógrafos</h1>
        <p class="text-sm text-muted">{{ lista?.total ?? 0 }} contas</p>
      </div>
      <UiBotao to="/licencas/emitir" variante="secundaria">Emitir licença</UiBotao>
    </div>

    <form class="card flex flex-wrap items-end gap-3 p-4" @submit.prevent="buscar">
      <label class="min-w-56 flex-1">
        <span class="rotulo">Buscar</span>
        <input v-model="filtro.q" class="campo" placeholder="nome, e-mail ou @slug" />
      </label>
      <label>
        <span class="rotulo">Status</span>
        <select v-model="filtro.status" class="campo w-40" @change="filtro.pagina = 1">
          <option value="">todos</option>
          <option value="ATIVA">Ativa</option>
          <option value="SUSPENSA">Suspensa</option>
          <option value="BLOQUEADA">Bloqueada</option>
        </select>
      </label>
      <label>
        <span class="rotulo">Plano</span>
        <select v-model="filtro.plano" class="campo w-40" @change="filtro.pagina = 1">
          <option value="">todos</option>
          <option value="gratuito">Gratuito</option>
          <option value="trial">Trial</option>
          <option value="pro">PRO</option>
        </select>
      </label>
      <UiBotao type="submit">Buscar</UiBotao>
    </form>

    <UiTabela
      :carregando="status === 'pending'"
      :vazio="lista && !lista.itens.length ? 'Nenhuma conta com esses filtros.' : undefined"
    >
      <template #cabecalho>
        <tr>
          <th class="px-4 py-2.5">Conta</th>
          <th class="px-4 py-2.5">Status</th>
          <th class="px-4 py-2.5">Plano</th>
          <th class="px-4 py-2.5">Licença</th>
          <th class="px-4 py-2.5 text-right">Galerias</th>
          <th class="px-4 py-2.5 text-right">Desktops</th>
          <th class="px-4 py-2.5">Cadastro</th>
        </tr>
      </template>
      <tr
        v-for="c in lista?.itens"
        :key="c.id"
        class="cursor-pointer hover:bg-surface-2/60"
        :class="{ 'bg-wine-dim/40': contaAberta === c.id }"
        @click="contaAberta = c.id"
      >
        <td class="px-4 py-2.5">
          <NuxtLink
            :to="`/fotografos/${c.id}`"
            class="block font-medium hover:text-wine-tint"
            title="Abrir a página completa"
            @click.stop
            >{{ c.nome }}</NuxtLink
          >
          <span class="block text-xs text-muted"
            >@{{ c.slug }} · {{ c.email
            }}<span v-if="!c.emailVerificado" class="text-warning">
              · e-mail não confirmado</span
            ></span
          >
        </td>
        <td class="px-4 py-2.5">
          <UiEtiqueta :cor="corStatus[c.status]">{{ rotuloStatus[c.status] }}</UiEtiqueta>
        </td>
        <td class="px-4 py-2.5">
          <UiEtiqueta :cor="corPlano[c.plano]">{{
            c.plano === 'pro' ? 'PRO' : c.plano
          }}</UiEtiqueta>
        </td>
        <td class="px-4 py-2.5 text-xs text-muted">
          <template v-if="c.licenca"
            >{{ rotuloTipoLicenca[c.licenca.tipo]
            }}<span v-if="c.licenca.validaAte">
              · até {{ data(c.licenca.validaAte) }}</span
            ></template
          >
          <template v-else>—</template>
        </td>
        <td class="px-4 py-2.5 text-right tabular-nums">{{ c.galerias }}</td>
        <td class="px-4 py-2.5 text-right tabular-nums">{{ c.dispositivos }}</td>
        <td class="px-4 py-2.5 text-xs text-muted">{{ data(c.criadoEm) }}</td>
      </tr>
    </UiTabela>

    <UiPaginacao
      v-if="lista"
      v-model:pagina="filtro.pagina"
      :por-pagina="lista.porPagina"
      :total="lista.total"
    />

    <FotografoDrawer
      :conta-id="contaAberta"
      @fechar="contaAberta = null"
      @navegar="navegar"
      @alterado="refresh()"
    />
  </div>
</template>
