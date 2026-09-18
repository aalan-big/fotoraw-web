<script setup lang="ts">
import type { ContaDetalhe, Licenca, StatusConta } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();
const rota = useRoute();
const { webUrl, fotografoUrl } = useRuntimeConfig().public;
const id = rota.params.id as string;

const {
  data: d,
  status,
  refresh,
} = await useAsyncData(`admin-conta-${id}`, () => api<ContaDetalhe>(`/admin/contas/${id}`));
useSeoMeta({ title: () => d.value?.conta.nome ?? 'Fotógrafo' });

const aba = ref<'licencas' | 'dispositivos' | 'galerias' | 'auditoria'>('licencas');
const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
const ocupado = ref(false);

async function agir(fn: () => Promise<unknown>, ok: string) {
  ocupado.value = true;
  msg.value = null;
  try {
    await fn();
    msg.value = { tipo: 'sucesso', texto: ok };
    await refresh();
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
  }
}

// --- status da conta ---
const statusForm = reactive({ aberto: false, status: 'SUSPENSA' as StatusConta, motivo: '' });
function abrirStatus(s: StatusConta) {
  statusForm.status = s;
  statusForm.motivo = '';
  statusForm.aberto = true;
}
function salvarStatus() {
  return agir(
    () =>
      api(`/admin/contas/${id}/status`, {
        method: 'PATCH',
        body: { status: statusForm.status, motivo: statusForm.motivo },
      }),
    `Conta ${rotuloStatus[statusForm.status]!.toLowerCase()}.`,
  ).then(() => (statusForm.aberto = false));
}

// --- licença ---
const licForm = reactive({
  aberto: false,
  licenca: null as Licenca | null,
  status: 'SUSPENSA' as 'ATIVA' | 'SUSPENSA' | 'REVOGADA',
  motivo: '',
});
function abrirLicenca(l: Licenca, s: 'ATIVA' | 'SUSPENSA' | 'REVOGADA') {
  licForm.licenca = l;
  licForm.status = s;
  licForm.motivo = '';
  licForm.aberto = true;
}
function salvarLicenca() {
  return agir(
    () =>
      api(`/admin/licencas/${licForm.licenca!.id}/status`, {
        method: 'PATCH',
        body: { status: licForm.status, motivo: licForm.motivo },
      }),
    `Licença ${rotuloStatus[licForm.status]!.toLowerCase()}.`,
  ).then(() => (licForm.aberto = false));
}

function reenviar() {
  return agir(
    () => api(`/admin/contas/${id}/reenviar-verificacao`, { method: 'POST' }),
    'E-mail de confirmação reenviado.',
  );
}
function revogarDispositivo(dispId: string, nome: string) {
  if (!confirm(`Desconectar "${nome}"? O desktop dessa máquina vai pedir login de novo.`)) return;
  return agir(
    () => api(`/admin/contas/${id}/dispositivos/${dispId}`, { method: 'DELETE' }),
    'Dispositivo desconectado.',
  );
}

const recursosLista = computed(() => {
  const r = d.value?.licencaAtual.recursos;
  if (!r) return [];
  return [
    ['Galerias ativas', r.limite_galerias_ativas ?? '∞'],
    ['Fotos por galeria', r.limite_fotos_por_galeria ?? '∞'],
    [
      'Armazenamento',
      r.limite_armazenamento_mb === null
        ? '∞'
        : `${Math.round(r.limite_armazenamento_mb / 1024)} GB`,
    ],
    ['Máquinas', r.limite_dispositivos ?? '∞'],
    ['Evento', r.permite_evento ? 'sim' : 'não'],
    ['Ensaio', r.permite_ensaio ? 'sim' : 'não'],
    ['Galeria privada', r.permite_galeria_privada ? 'sim' : 'não'],
    ['Gestão do estúdio', r.permite_gestao_estudio ? 'sim' : 'não'],
  ] as const;
});
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <NuxtLink to="/fotografos" class="text-sm text-muted hover:text-text">← Fotógrafos</NuxtLink>

    <p v-if="status === 'pending'" class="text-sm text-muted">Carregando…</p>

    <template v-else-if="d">
      <!-- cabeçalho -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold">{{ d.conta.nome }}</h1>
            <UiEtiqueta :cor="corStatus[d.conta.status]">{{
              rotuloStatus[d.conta.status]
            }}</UiEtiqueta>
            <UiEtiqueta :cor="corPlano[d.licencaAtual.plano]">{{
              d.licencaAtual.plano === 'pro' ? 'PRO' : d.licencaAtual.plano
            }}</UiEtiqueta>
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ d.conta.email }}
            <span v-if="!d.conta.emailVerificado" class="text-warning">
              · e-mail não confirmado</span
            >
            · cadastro em {{ data(d.conta.criadoEm) }}
          </p>
          <a
            :href="`${webUrl}/@${d.conta.slug}`"
            target="_blank"
            class="text-sm text-wine-tint hover:underline"
            >fotoraw.com.br/@{{ d.conta.slug }}</a
          >
        </div>
        <div class="flex flex-wrap gap-2">
          <UiBotao
            v-if="!d.conta.emailVerificado"
            variante="secundaria"
            :disabled="ocupado"
            @click="reenviar"
            >Reenviar confirmação</UiBotao
          >
          <UiBotao
            v-if="d.conta.status !== 'ATIVA'"
            :disabled="ocupado"
            @click="abrirStatus('ATIVA')"
            >Reativar</UiBotao
          >
          <UiBotao
            v-if="d.conta.status === 'ATIVA'"
            variante="secundaria"
            :disabled="ocupado"
            @click="abrirStatus('SUSPENSA')"
            >Suspender</UiBotao
          >
          <UiBotao
            v-if="d.conta.status !== 'BLOQUEADA'"
            variante="secundaria"
            class="!text-danger"
            :disabled="ocupado"
            @click="abrirStatus('BLOQUEADA')"
            >Bloquear</UiBotao
          >
        </div>
      </div>

      <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

      <!-- formulário de status -->
      <form
        v-if="statusForm.aberto"
        class="card space-y-3 border-warning/40 p-4"
        @submit.prevent="salvarStatus"
      >
        <p class="text-sm">
          <strong>{{ rotuloStatus[statusForm.status] }}</strong> —
          <span v-if="statusForm.status === 'SUSPENSA'"
            >vitrine continua no ar, publicar fica bloqueado.</span
          >
          <span v-else-if="statusForm.status === 'BLOQUEADA'"
            >nada funciona; painel e desktop são desconectados agora.</span
          >
          <span v-else>volta ao normal.</span>
        </p>
        <UiCampo
          v-model="statusForm.motivo"
          rotulo="Motivo (vai pra auditoria)"
          required
          placeholder="ex.: pagamento pendente há 30 dias"
        />
        <div class="flex gap-2">
          <UiBotao type="submit" :disabled="ocupado || statusForm.motivo.trim().length < 3"
            >Confirmar</UiBotao
          >
          <UiBotao variante="fantasma" @click="statusForm.aberto = false">Cancelar</UiBotao>
        </div>
      </form>

      <!-- números -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UiStat
          rotulo="Vendas pagas"
          :valor="dinheiro(d.vendas.totalCentavos)"
          :detalhe="`${d.vendas.pedidosPagos} pedidos`"
        />
        <UiStat rotulo="Comissão gerada" :valor="dinheiro(d.vendas.comissaoCentavos)" />
        <UiStat rotulo="Galerias" :valor="d.totais.galerias" />
        <UiStat
          rotulo="Desktops conectados"
          :valor="d.dispositivos.filter((x) => x.conectado).length"
        />
      </div>

      <!-- licença atual -->
      <UiCartao
        titulo="Licença atual"
        :descricao="
          d.licencaAtual.chave
            ? `${rotuloTipoLicenca[d.licencaAtual.tipo!]} · ${d.licencaAtual.chave}${d.licencaAtual.validaAte ? ` · válida até ${data(d.licencaAtual.validaAte)}` : ' · não vence'}`
            : 'Sem licença emitida — plano gratuito (só evento)'
        "
      >
        <template #acoes>
          <UiBotao :to="`/licencas/emitir?contaId=${d.conta.id}`" variante="secundaria"
            >Emitir nova</UiBotao
          >
        </template>
        <dl class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
          <template v-for="[k, v] in recursosLista" :key="k">
            <dt class="text-muted">{{ k }}</dt>
            <dd class="font-medium tabular-nums">{{ v }}</dd>
          </template>
        </dl>
      </UiCartao>

      <!-- abas -->
      <div class="flex gap-1 border-b border-border">
        <button
          v-for="a in ['licencas', 'dispositivos', 'galerias', 'auditoria'] as const"
          :key="a"
          type="button"
          class="px-3 py-2 text-sm capitalize"
          :class="
            aba === a
              ? 'border-b-2 border-wine font-medium text-text'
              : 'text-muted hover:text-text'
          "
          @click="aba = a"
        >
          {{ a === 'licencas' ? 'Histórico de licenças' : a }}
        </button>
      </div>

      <UiTabela
        v-if="aba === 'licencas'"
        :vazio="!d.licencas.length ? 'Nenhuma licença emitida.' : undefined"
      >
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2.5">Chave</th>
            <th class="px-4 py-2.5">Tipo</th>
            <th class="px-4 py-2.5">Status</th>
            <th class="px-4 py-2.5">Validade</th>
            <th class="px-4 py-2.5">Motivo</th>
            <th class="px-4 py-2.5">Emitida</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </template>
        <tr v-for="l in d.licencas" :key="l.id">
          <td class="px-4 py-2.5 font-mono text-xs">{{ l.chave }}</td>
          <td class="px-4 py-2.5">{{ rotuloTipoLicenca[l.tipo] }}</td>
          <td class="px-4 py-2.5">
            <UiEtiqueta :cor="corStatus[l.status]">{{ rotuloStatus[l.status] }}</UiEtiqueta>
          </td>
          <td class="px-4 py-2.5 text-xs">{{ l.validaAte ? data(l.validaAte) : 'não vence' }}</td>
          <td class="max-w-64 truncate px-4 py-2.5 text-xs text-muted" :title="l.motivo ?? ''">
            {{ (l.motivo ?? '').replace(/^plano:[^ ]+ · /, '') }}
          </td>
          <td class="px-4 py-2.5 text-xs text-muted">{{ data(l.emitidaEm) }}</td>
          <td class="px-4 py-2.5 text-right text-xs whitespace-nowrap">
            <template v-if="l.status === 'ATIVA'">
              <button
                type="button"
                class="text-warning hover:underline"
                @click="abrirLicenca(l, 'SUSPENSA')"
              >
                Suspender
              </button>
              <span class="mx-1 text-muted">·</span>
              <button
                type="button"
                class="text-danger hover:underline"
                @click="abrirLicenca(l, 'REVOGADA')"
              >
                Revogar
              </button>
            </template>
            <template v-else-if="l.status === 'SUSPENSA'">
              <button
                type="button"
                class="text-success hover:underline"
                @click="abrirLicenca(l, 'ATIVA')"
              >
                Reativar
              </button>
              <span class="mx-1 text-muted">·</span>
              <button
                type="button"
                class="text-danger hover:underline"
                @click="abrirLicenca(l, 'REVOGADA')"
              >
                Revogar
              </button>
            </template>
          </td>
        </tr>
      </UiTabela>

      <form
        v-if="licForm.aberto && licForm.licenca"
        class="card space-y-3 border-warning/40 p-4"
        @submit.prevent="salvarLicenca"
      >
        <p class="text-sm">
          <strong>{{ rotuloStatus[licForm.status] }}</strong> a licença {{ licForm.licenca.chave }}.
          <span v-if="licForm.status !== 'ATIVA'">
            O desktop e o painel caem pro gratuito na próxima consulta.</span
          >
        </p>
        <UiCampo v-model="licForm.motivo" rotulo="Motivo" required />
        <div class="flex gap-2">
          <UiBotao type="submit" :disabled="ocupado || licForm.motivo.trim().length < 3"
            >Confirmar</UiBotao
          >
          <UiBotao variante="fantasma" @click="licForm.aberto = false">Cancelar</UiBotao>
        </div>
      </form>

      <UiTabela
        v-if="aba === 'dispositivos'"
        :vazio="!d.dispositivos.length ? 'Nenhuma máquina conectou ainda.' : undefined"
      >
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2.5">Máquina</th>
            <th class="px-4 py-2.5">Versão</th>
            <th class="px-4 py-2.5">Estado</th>
            <th class="px-4 py-2.5">Último uso</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </template>
        <tr v-for="x in d.dispositivos" :key="x.id">
          <td class="px-4 py-2.5 font-medium">{{ x.nome }}</td>
          <td class="px-4 py-2.5 text-xs text-muted">{{ x.versaoApp ?? '—' }}</td>
          <td class="px-4 py-2.5">
            <UiEtiqueta
              :cor="x.conectado ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'"
              >{{ x.conectado ? 'conectada' : 'desconectada' }}</UiEtiqueta
            >
          </td>
          <td class="px-4 py-2.5 text-xs text-muted">
            {{ dataHora(x.ultimoUsoEm ?? x.ultimoVistoEm) }}
          </td>
          <td class="px-4 py-2.5 text-right text-xs">
            <button
              v-if="x.conectado"
              type="button"
              class="text-danger hover:underline"
              :disabled="ocupado"
              @click="revogarDispositivo(x.id, x.nome)"
            >
              Desconectar
            </button>
          </td>
        </tr>
      </UiTabela>

      <UiTabela
        v-if="aba === 'galerias'"
        :vazio="!d.galerias.length ? 'Nenhuma galeria publicada.' : undefined"
      >
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2.5">Galeria</th>
            <th class="px-4 py-2.5">Tipo</th>
            <th class="px-4 py-2.5">Status</th>
            <th class="px-4 py-2.5 text-right">Fotos</th>
            <th class="px-4 py-2.5">Publicada</th>
          </tr>
        </template>
        <tr v-for="g in d.galerias" :key="g.id">
          <td class="px-4 py-2.5">
            <a
              :href="`${webUrl}/@${d.conta.slug}/${g.slug}`"
              target="_blank"
              class="font-medium hover:text-wine-tint"
              >{{ g.titulo }}</a
            >
          </td>
          <td class="px-4 py-2.5 text-xs text-muted">
            {{ g.modalidade.toLowerCase() }} · {{ g.visibilidade.toLowerCase() }}
          </td>
          <td class="px-4 py-2.5 text-xs">{{ g.status.toLowerCase() }}</td>
          <td class="px-4 py-2.5 text-right tabular-nums">{{ g.totalFotos }}</td>
          <td class="px-4 py-2.5 text-xs text-muted">{{ data(g.publicadaEm) }}</td>
        </tr>
      </UiTabela>

      <UiTabela
        v-if="aba === 'auditoria'"
        :vazio="!d.auditorias.length ? 'Nada registrado.' : undefined"
      >
        <template #cabecalho>
          <tr>
            <th class="px-4 py-2.5">Quando</th>
            <th class="px-4 py-2.5">Ação</th>
            <th class="px-4 py-2.5">Quem</th>
            <th class="px-4 py-2.5">Detalhe</th>
          </tr>
        </template>
        <tr v-for="a in d.auditorias" :key="a.id">
          <td class="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
            {{ dataHora(a.criadoEm) }}
          </td>
          <td class="px-4 py-2.5 font-mono text-xs">{{ a.acao }}</td>
          <td class="px-4 py-2.5 text-xs">
            {{ a.ator ? `${a.ator.nome}${a.ator.papel === 'ADMIN' ? ' (admin)' : ''}` : 'sistema' }}
          </td>
          <td
            class="max-w-md truncate px-4 py-2.5 font-mono text-[11px] text-muted"
            :title="JSON.stringify(a.depois)"
          >
            {{ a.depois ? JSON.stringify(a.depois) : '' }}
          </td>
        </tr>
      </UiTabela>

      <p class="text-xs text-muted">
        Painel do fotógrafo:
        <a :href="fotografoUrl" target="_blank" class="text-wine-tint hover:underline">{{
          fotografoUrl
        }}</a>
      </p>
    </template>
  </div>
</template>
