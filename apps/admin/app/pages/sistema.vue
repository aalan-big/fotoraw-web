<script setup lang="ts">
import type { Paginado, SaudeSistema, SyncLote, WebhookRecebido } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Sistema' });

const api = useApi();

const { data: saude, refresh: recarregarSaude } = await useAsyncData('admin-saude', () =>
  api<SaudeSistema>('/admin/sistema/saude'),
);
const situacaoWebhook = ref<'' | 'erro' | 'pendente' | 'ok'>('erro');
const { data: webhooks, refresh: recarregarWebhooks } = await useAsyncData(
  'admin-webhooks',
  () =>
    api<Paginado<WebhookRecebido>>('/admin/sistema/webhooks', {
      query: { situacao: situacaoWebhook.value || undefined, porPagina: 30 },
    }),
  { watch: [situacaoWebhook] },
);
const statusSync = ref<'' | 'ERRO' | 'PROCESSANDO' | 'CONCLUIDO'>('ERRO');
const { data: lotes } = await useAsyncData(
  'admin-sync',
  () =>
    api<Paginado<SyncLote>>('/admin/sistema/sync', {
      query: { status: statusSync.value || undefined, porPagina: 30 },
    }),
  { watch: [statusSync] },
);

const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
async function reprocessar(w: WebhookRecebido) {
  msg.value = null;
  try {
    await api(`/admin/sistema/webhooks/${w.id}/reprocessar`, { method: 'POST' });
    msg.value = { tipo: 'sucesso', texto: `Webhook ${w.tipo} devolvido à fila.` };
    await Promise.all([recarregarWebhooks(), recarregarSaude()]);
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  }
}
const aberto = ref<string | null>(null);

const tempo = (s: number) => {
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
};
interface Indicador {
  rotulo: string;
  valor: string;
  ok: boolean;
  detalhe?: string;
}
const indicadores = computed<Indicador[]>(() => {
  const s = saude.value;
  if (!s) return [];
  return [
    { rotulo: 'Banco', valor: s.banco === 'ok' ? 'ok' : 'erro', ok: s.banco === 'ok' },
    {
      rotulo: 'E-mail',
      valor: s.email === 'configurado' ? 'Resend' : 'só no log',
      ok: s.email === 'configurado',
      detalhe: s.email === 'configurado' ? undefined : 'RESEND_API_KEY vazio — e-mails não saem',
    },
    {
      rotulo: 'Storage',
      valor: s.storage === 'configurado' ? 'configurado' : 'ausente',
      ok: s.storage === 'configurado',
    },
    {
      rotulo: 'Webhooks',
      valor: s.webhooks.comErro ? `${s.webhooks.comErro} com erro` : 'ok',
      ok: s.webhooks.comErro === 0,
      detalhe: `${s.webhooks.pendentes} pendente(s) · último ${s.webhooks.ultimoEm ? dataHora(s.webhooks.ultimoEm) : 'nunca'}`,
    },
    {
      rotulo: 'Sync desktop',
      valor:
        s.sync.comErro || s.sync.travados
          ? `${s.sync.comErro} erro · ${s.sync.travados} travado`
          : 'ok',
      ok: s.sync.comErro === 0 && s.sync.travados === 0,
      detalhe: `último lote ${s.sync.ultimoEm ? dataHora(s.sync.ultimoEm) : 'nunca'}`,
    },
    {
      rotulo: 'API',
      valor: `no ar há ${tempo(s.noArHaSegundos)}`,
      ok: true,
      detalhe: `${s.ambiente} · node ${s.versaoNode} · ${s.memoriaMb} MB`,
    },
  ];
});
const rotuloSync: Record<string, string> = {
  PUBLICAR: 'publicar',
  ATUALIZAR_FOTOS: 'atualizar fotos',
  DESPUBLICAR: 'despublicar',
  PUXAR_PEDIDOS: 'puxar pedidos',
};
const corSync: Record<string, string> = {
  RECEBIDO: 'bg-info/15 text-info',
  PROCESSANDO: 'bg-warning/15 text-warning',
  CONCLUIDO: 'bg-success/15 text-success',
  ERRO: 'bg-danger/15 text-danger',
};
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Sistema</h1>
        <p class="text-sm text-muted">
          Saúde da API, webhooks dos provedores e lotes de sync do desktop.
        </p>
      </div>
      <UiBotao variante="secundaria" @click="recarregarSaude()">Atualizar</UiBotao>
    </div>

    <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="i in indicadores"
        :key="i.rotulo"
        class="card p-4"
        :class="{ 'border-danger/40': !i.ok }"
      >
        <p class="rotulo flex items-center gap-2">
          <span class="size-2 rounded-full" :class="i.ok ? 'bg-success' : 'bg-danger'" />{{
            i.rotulo
          }}
        </p>
        <p class="text-lg font-semibold" :class="{ 'text-danger': !i.ok }">{{ i.valor }}</p>
        <p v-if="i.detalhe" class="text-xs text-muted">{{ i.detalhe }}</p>
      </div>
    </div>

    <!-- webhooks -->
    <UiCartao
      titulo="Webhooks recebidos"
      descricao="Mercado Pago e Stripe avisam por aqui. Erro = gravou mas não processou."
    >
      <template #acoes>
        <select v-model="situacaoWebhook" class="campo h-8 w-36 py-0 text-xs">
          <option value="erro">com erro</option>
          <option value="pendente">pendentes</option>
          <option value="ok">processados</option>
          <option value="">todos</option>
        </select>
      </template>
      <UiTabela
        :vazio="webhooks && !webhooks.itens.length ? 'Nenhum webhook nessa situação.' : undefined"
      >
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2">Quando</th>
            <th class="px-4 py-2">Provedor</th>
            <th class="px-4 py-2">Evento</th>
            <th class="px-4 py-2">Situação</th>
            <th class="px-4 py-2"></th>
          </tr>
        </template>
        <template v-for="w in webhooks?.itens" :key="w.id">
          <tr
            class="cursor-pointer hover:bg-surface-2/60"
            @click="aberto = aberto === w.id ? null : w.id"
          >
            <td class="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
              {{ dataHora(w.criadoEm) }}
            </td>
            <td class="px-4 py-2.5 text-xs">{{ w.provedor.toLowerCase() }}</td>
            <td class="px-4 py-2.5">
              <span class="block text-sm">{{ w.tipo }}</span>
              <span class="block font-mono text-[11px] text-muted">{{ w.eventoRef }}</span>
            </td>
            <td class="px-4 py-2.5 text-xs">
              <span v-if="w.erro" class="text-danger">{{ w.erro }}</span>
              <span v-else-if="w.processadoEm" class="text-success"
                >processado {{ dataHora(w.processadoEm) }}</span
              >
              <span v-else class="text-muted">pendente</span>
            </td>
            <td class="px-4 py-2.5 text-right">
              <UiBotao v-if="w.erro" variante="secundaria" @click.stop="reprocessar(w)"
                >Reprocessar</UiBotao
              >
            </td>
          </tr>
          <tr v-if="aberto === w.id">
            <td colspan="5" class="bg-bg/60 px-4 py-3">
              <pre
                class="max-h-80 overflow-auto rounded-md border border-border bg-surface p-2 font-mono text-[11px]"
                >{{ JSON.stringify(w.payload, null, 2) }}</pre>
            </td>
          </tr>
        </template>
      </UiTabela>
    </UiCartao>

    <!-- sync -->
    <UiCartao
      titulo="Lotes de sync do desktop"
      descricao="Cada publicação/atualização que o desktop manda."
    >
      <template #acoes>
        <select v-model="statusSync" class="campo h-8 w-36 py-0 text-xs">
          <option value="ERRO">com erro</option>
          <option value="PROCESSANDO">processando</option>
          <option value="CONCLUIDO">concluídos</option>
          <option value="">todos</option>
        </select>
      </template>
      <UiTabela :vazio="lotes && !lotes.itens.length ? 'Nenhum lote nessa situação.' : undefined">
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2">Início</th>
            <th class="px-4 py-2">Fotógrafo</th>
            <th class="px-4 py-2">Tipo</th>
            <th class="px-4 py-2">Galeria</th>
            <th class="px-4 py-2 text-right">Itens</th>
            <th class="px-4 py-2">Status</th>
          </tr>
        </template>
        <tr v-for="l in lotes?.itens" :key="l.id" class="hover:bg-surface-2/60">
          <td class="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
            {{ dataHora(l.iniciadoEm) }}
          </td>
          <td class="px-4 py-2.5">
            <NuxtLink :to="`/fotografos/${l.conta.id}`" class="hover:text-wine-tint">{{
              l.conta.nome
            }}</NuxtLink>
          </td>
          <td class="px-4 py-2.5 text-xs">{{ rotuloSync[l.tipo] }}</td>
          <td class="px-4 py-2.5 text-xs">{{ l.galeria?.titulo ?? '—' }}</td>
          <td class="px-4 py-2.5 text-right text-xs tabular-nums">
            {{ l.itensOk }}/{{ l.totalItens
            }}<span v-if="l.itensErro" class="text-danger"> · {{ l.itensErro }} erro</span>
          </td>
          <td class="px-4 py-2.5">
            <UiEtiqueta :cor="corSync[l.status]">{{ l.status.toLowerCase() }}</UiEtiqueta>
            <span v-if="l.erro" class="ml-1 text-xs text-danger" :title="l.erro">{{
              l.erro.slice(0, 60)
            }}</span>
          </td>
        </tr>
      </UiTabela>
    </UiCartao>
  </div>
</template>
