<script setup lang="ts">
import type { Dispositivo } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Dispositivos' });

const api = useApi();
const sessao = useSessao();
const {
  data: lista,
  refresh,
  status,
} = await useAsyncData('dispositivos', () => api<Dispositivo[]>('/me/dispositivos'));

const limite = computed(() => sessao.eu?.licenca.recursos.limite_dispositivos ?? null);
const conectados = computed(() => lista.value?.filter((d) => d.conectado).length ?? 0);

const revogando = ref<string | null>(null);
const erro = ref('');
async function revogar(d: Dispositivo) {
  if (!confirm(`Desconectar "${d.nome}"? O FotoRAW dessa máquina vai pedir login de novo.`)) return;
  revogando.value = d.id;
  erro.value = '';
  try {
    await api(`/me/dispositivos/${d.id}`, { method: 'DELETE' });
    await refresh();
  } catch (e) {
    erro.value = lerErroApi(e).mensagem;
  } finally {
    revogando.value = null;
  }
}

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Dispositivos</h1>
      <p class="text-sm text-muted">
        Máquinas com o FotoRAW desktop conectado a esta conta.
        <template v-if="limite !== null">
          Sua licença permite <strong>{{ limite }}</strong> — {{ conectados }} em uso.
        </template>
      </p>
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>

    <div v-if="status === 'pending'" class="card p-8 text-center text-sm text-muted">
      Carregando…
    </div>

    <div v-else-if="!lista?.length" class="card p-8 text-center">
      <p class="font-medium">Nenhuma máquina conectada</p>
      <p class="mt-1 text-sm text-muted">
        Abra o FotoRAW no computador e entre com
        <strong class="text-text">{{ sessao.conta?.email }}</strong
        >.
      </p>
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="d in lista"
        :key="d.id"
        class="card flex flex-wrap items-center justify-between gap-4 p-4"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="d.conectado ? 'bg-success' : 'bg-muted/50'"
            />
            <span class="truncate font-medium">{{ d.nome }}</span>
            <span v-if="d.versaoApp" class="text-xs text-muted">v{{ d.versaoApp }}</span>
          </div>
          <div class="mt-1 text-xs text-muted">
            <template v-if="d.conectado">
              Último uso: {{ quando(d.ultimoUsoEm ?? d.ultimoVistoEm) }}
            </template>
            <template v-else>Desconectada · última vez {{ quando(d.ultimoVistoEm) }}</template>
          </div>
        </div>
        <UiBotao
          v-if="d.conectado"
          variante="secundaria"
          :disabled="revogando === d.id"
          @click="revogar(d)"
        >
          {{ revogando === d.id ? 'Desconectando…' : 'Desconectar' }}
        </UiBotao>
      </li>
    </ul>
  </div>
</template>
