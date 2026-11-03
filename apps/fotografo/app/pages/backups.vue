<script setup lang="ts">
import type { BackupDesktop } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Backups do desktop' });

const api = useApi();
const { data, status } = await useAsyncData('backups', () =>
  api<{ backups: BackupDesktop[] }>('/me/backups'),
);
const lista = computed(() => data.value?.backups ?? []);
const ultimo = computed(() => lista.value[0] ?? null);
/** mais de 2 dias sem backup = o desktop não está mandando (desligado, sem internet…) */
const atrasado = computed(() => {
  const em = ultimo.value?.concluidoEm;
  return em ? Date.now() - new Date(em).getTime() > 2 * 24 * 60 * 60 * 1000 : false;
});

const ROTULOS: Record<string, [string, string]> = {
  ensaios: ['ensaio', 'ensaios'],
  clientes: ['cliente', 'clientes'],
  fotos: ['foto', 'fotos'],
  agendamentos: ['agendamento', 'agendamentos'],
  contratos: ['contrato', 'contratos'],
  lancamentos: ['lançamento', 'lançamentos'],
};
function resumo(b: BackupDesktop): string {
  if (!b.resumo) return '';
  return Object.entries(b.resumo)
    .filter(([k]) => ROTULOS[k])
    .map(([k, n]) => `${n.toLocaleString('pt-BR')} ${ROTULOS[k]![n === 1 ? 0 : 1]}`)
    .join(' · ');
}

const tamanho = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
    : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const baixando = ref<string | null>(null);
const erro = ref('');
async function baixar(b: BackupDesktop) {
  baixando.value = b.id;
  erro.value = '';
  try {
    const { url } = await api<{ url: string }>(`/me/backups/${b.id}/arquivo`);
    window.location.href = url;
  } catch (e) {
    erro.value = lerErroApi(e).mensagem;
  } finally {
    baixando.value = null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Backups do desktop</h1>
      <p class="text-sm text-muted">
        O FotoRAW do computador guarda na nuvem uma cópia dos seus clientes, agenda, financeiro,
        contratos e ensaios. Se o computador quebrar ou for formatado, é só entrar com esta conta
        num computador novo e restaurar. Ficam os últimos 7 dias e as últimas 4 semanas.
      </p>
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>

    <div v-if="status === 'pending'" class="card p-8 text-center text-sm text-muted">
      Carregando…
    </div>

    <div v-else-if="!lista.length" class="card p-8 text-center">
      <p class="font-medium">Nenhum backup ainda</p>
      <p class="mt-1 text-sm text-muted">
        O backup é feito sozinho pelo FotoRAW desktop: ao fechar o programa e uma vez por dia. Também
        dá pra fazer na hora, em Configurações → Backup.
      </p>
    </div>

    <template v-else>
      <UiAlerta v-if="atrasado" tipo="aviso">
        O último backup é de {{ quando(ultimo!.concluidoEm) }}. Abra o FotoRAW no computador com
        internet pra ele mandar um novo.
      </UiAlerta>

      <ul class="space-y-3">
        <li
          v-for="(b, i) in lista"
          :key="b.id"
          class="card flex flex-wrap items-center justify-between gap-4 p-4"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ quando(b.concluidoEm) }}</span>
              <span v-if="i === 0" class="rounded bg-success/15 px-1.5 py-0.5 text-xs text-success">
                mais recente
              </span>
            </div>
            <div class="mt-1 text-xs text-muted">
              {{ b.computador ?? 'Computador removido' }} · {{ tamanho(b.tamanhoBytes) }}
              <template v-if="b.versaoApp"> · v{{ b.versaoApp }}</template>
            </div>
            <div v-if="resumo(b)" class="mt-0.5 text-xs text-muted">{{ resumo(b) }}</div>
          </div>
          <UiBotao variante="secundaria" :disabled="baixando === b.id" @click="baixar(b)">
            {{ baixando === b.id ? 'Gerando link…' : 'Baixar' }}
          </UiBotao>
        </li>
      </ul>
    </template>
  </div>
</template>
