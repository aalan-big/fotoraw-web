<script setup lang="ts">
import type { AdminLista } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Admins' });

const api = useApi();
const sessao = useSessao();

const { data: admins, refresh } = await useAsyncData('admin-admins', () =>
  api<AdminLista[]>('/admin/admins'),
);

const msg = ref<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
const ocupado = ref(false);
const erros = ref<Record<string, string>>({});
async function agir(fn: () => Promise<unknown>, ok: string) {
  ocupado.value = true;
  msg.value = null;
  erros.value = {};
  try {
    await fn();
    msg.value = { tipo: 'sucesso', texto: ok };
    await refresh();
    return true;
  } catch (e) {
    const apiErro = lerErroApi(e);
    erros.value = errosPorCampo(apiErro);
    msg.value = { tipo: 'erro', texto: apiErro.mensagem };
    return false;
  } finally {
    ocupado.value = false;
  }
}

// --- criar ---
const criando = ref(false);
const form = reactive({ nome: '', email: '', senha: '' });
async function criar() {
  const ok = await agir(
    () => api('/admin/admins', { method: 'POST', body: { ...form } }),
    `${form.nome} agora é admin. Passe a senha pessoalmente e peça pra ativar o 2FA no primeiro acesso.`,
  );
  if (ok) {
    criando.value = false;
    Object.assign(form, { nome: '', email: '', senha: '' });
  }
}

// --- status / 2FA de outro ---
function alternarStatus(a: AdminLista) {
  const bloquear = a.status !== 'BLOQUEADA';
  const motivo = prompt(`${bloquear ? 'Bloquear' : 'Reativar'} ${a.nome}? Motivo (auditoria):`);
  if (!motivo || motivo.trim().length < 3) return;
  return agir(
    () =>
      api(`/admin/admins/${a.id}/status`, {
        method: 'PATCH',
        body: { status: bloquear ? 'BLOQUEADA' : 'ATIVA', motivo },
      }),
    bloquear ? `${a.nome} bloqueado — sessões derrubadas.` : `${a.nome} reativado.`,
  );
}
function zerar2fa(a: AdminLista) {
  const motivo = prompt(
    `Zerar o 2FA de ${a.nome}? Ele vai reconfigurar no próximo acesso. Motivo:`,
  );
  if (!motivo || motivo.trim().length < 3) return;
  return agir(
    () => api(`/admin/admins/${a.id}/2fa`, { method: 'DELETE', body: { motivo } }),
    `2FA de ${a.nome} zerado e sessões derrubadas.`,
  );
}
const souEu = (a: AdminLista) => a.id === sessao.conta?.id;
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Admins</h1>
        <p class="text-sm text-muted">
          Quem entra no admin. Só você por enquanto — crie outro apenas pra alguém de confiança.
        </p>
      </div>
      <UiBotao @click="criando = !criando">Novo admin</UiBotao>
    </div>

    <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

    <form v-if="criando" class="card space-y-4 p-5" @submit.prevent="criar">
      <p class="text-sm text-muted">
        A conta nasce com o e-mail já confirmado e sem 2FA. A senha você define aqui e passa
        pessoalmente; ela não vai por e-mail.
      </p>
      <div class="grid gap-4 sm:grid-cols-3">
        <UiCampo v-model="form.nome" rotulo="Nome" required :erro="erros.nome" />
        <UiCampo v-model="form.email" rotulo="E-mail" type="email" required :erro="erros.email" />
        <UiCampo
          v-model="form.senha"
          rotulo="Senha inicial"
          type="password"
          autocomplete="new-password"
          required
          :erro="erros.senha"
          ajuda="mínimo 8, evite senhas comuns"
        />
      </div>
      <div class="flex gap-2">
        <UiBotao type="submit" :disabled="ocupado">Criar admin</UiBotao>
        <UiBotao variante="fantasma" @click="criando = false">Cancelar</UiBotao>
      </div>
    </form>

    <UiTabela>
      <template #cabecalho>
        <tr>
          <th class="px-4 py-2.5">Admin</th>
          <th class="px-4 py-2.5">Status</th>
          <th class="px-4 py-2.5">2FA</th>
          <th class="px-4 py-2.5">Último acesso</th>
          <th class="px-4 py-2.5">Desde</th>
          <th class="px-4 py-2.5"></th>
        </tr>
      </template>
      <tr v-for="a in admins" :key="a.id" class="hover:bg-surface-2/60">
        <td class="px-4 py-2.5">
          <span class="font-medium">{{ a.nome }}</span>
          <span v-if="souEu(a)" class="ml-1 text-xs text-muted">(você)</span>
          <span class="block text-xs text-muted">{{ a.email }}</span>
        </td>
        <td class="px-4 py-2.5">
          <UiEtiqueta :cor="corStatus[a.status]">{{ rotuloStatus[a.status] }}</UiEtiqueta>
        </td>
        <td class="px-4 py-2.5">
          <UiEtiqueta
            :cor="a.totpAtivo ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'"
          >
            {{ a.totpAtivo ? 'ativo' : 'desligado' }}
          </UiEtiqueta>
        </td>
        <td class="px-4 py-2.5 text-xs text-muted">
          {{ a.ultimoLoginEm ? dataHora(a.ultimoLoginEm) : 'nunca' }}
        </td>
        <td class="px-4 py-2.5 text-xs text-muted">{{ data(a.criadoEm) }}</td>
        <td class="px-4 py-2.5 text-right text-xs whitespace-nowrap">
          <NuxtLink v-if="souEu(a)" to="/seguranca" class="text-wine-tint hover:underline"
            >meu 2FA</NuxtLink
          >
          <template v-else>
            <button
              type="button"
              class="text-wine-tint hover:underline"
              :disabled="ocupado"
              @click="alternarStatus(a)"
            >
              {{ a.status === 'BLOQUEADA' ? 'reativar' : 'bloquear' }}
            </button>
            <button
              v-if="a.totpAtivo"
              type="button"
              class="ml-3 text-muted hover:text-text"
              :disabled="ocupado"
              @click="zerar2fa(a)"
            >
              zerar 2FA
            </button>
          </template>
        </td>
      </tr>
    </UiTabela>

    <p class="text-xs text-muted">
      Também dá pra criar/promover pelo terminal do server:
      <span class="font-mono">pnpm admin:criar --nome --email --senha</span>.
    </p>
  </div>
</template>
