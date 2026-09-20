<script setup lang="ts">
import type { Estado2fa } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Segurança' });

const api = useApi();
const sessao = useSessao();
const rota = useRoute();
const obrigatorio = rota.query.obrigatorio === '1';

const { data: estado, refresh } = await useAsyncData('admin-2fa', () =>
  api<Estado2fa>('/admin/2fa'),
);

const msg = ref<{ tipo: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);
const ocupado = ref(false);
async function agir<T>(fn: () => Promise<T>): Promise<T | null> {
  ocupado.value = true;
  msg.value = null;
  try {
    return await fn();
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
    return null;
  } finally {
    ocupado.value = false;
  }
}

// --- ativar: QR → código → códigos de recuperação -------------------------------
const setup = ref<{ segredo: string; otpauth: string; qr: string } | null>(null);
const codigoAtivar = ref('');
const codigosRecuperacao = ref<string[] | null>(null);
const mostrarSegredo = ref(false);

async function iniciar() {
  const r = await agir(() =>
    api<{ segredo: string; otpauth: string; qr: string }>('/admin/2fa/iniciar', { method: 'POST' }),
  );
  if (r) {
    setup.value = r;
    codigoAtivar.value = '';
  }
}
async function confirmar() {
  const r = await agir(() =>
    api<{ codigos: string[] }>('/admin/2fa/confirmar', {
      method: 'POST',
      body: { codigo: codigoAtivar.value },
    }),
  );
  if (r) {
    codigosRecuperacao.value = r.codigos;
    setup.value = null;
    sessao.marcarTotp(true);
    await refresh();
    msg.value = {
      tipo: 'sucesso',
      texto: 'Verificação em duas etapas ativada. Guarde os códigos abaixo.',
    };
  }
}

// --- regenerar códigos / desativar -------------------------------------------------
const codigoAcao = ref('');
const senhaAcao = ref('');
const acao = ref<'' | 'codigos' | 'desativar'>('');
async function novosCodigos() {
  const r = await agir(() =>
    api<{ codigos: string[] }>('/admin/2fa/codigos', {
      method: 'POST',
      body: { codigo: codigoAcao.value },
    }),
  );
  if (r) {
    codigosRecuperacao.value = r.codigos;
    acao.value = '';
    codigoAcao.value = '';
    await refresh();
    msg.value = { tipo: 'sucesso', texto: 'Códigos novos gerados — os antigos não valem mais.' };
  }
}
async function desativar() {
  const r = await agir(() =>
    api('/admin/2fa', {
      method: 'DELETE',
      body: { senha: senhaAcao.value, codigo: codigoAcao.value },
    }),
  );
  if (r !== null) {
    acao.value = '';
    codigoAcao.value = '';
    senhaAcao.value = '';
    codigosRecuperacao.value = null;
    sessao.marcarTotp(false);
    await refresh();
    msg.value = { tipo: 'aviso', texto: 'Verificação em duas etapas desativada.' };
  }
}
function copiarCodigos() {
  if (codigosRecuperacao.value)
    navigator.clipboard.writeText(codigosRecuperacao.value.join('\n')).catch(() => null);
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-5">
    <div>
      <h1 class="text-2xl font-semibold">Segurança</h1>
      <p class="text-sm text-muted">
        Verificação em duas etapas da sua conta admin ({{ sessao.conta?.email }}). Com ela ligada,
        entrar pede a senha <em>e</em> um código do app autenticador.
      </p>
    </div>

    <UiAlerta v-if="obrigatorio && !estado?.ativo" tipo="aviso">
      Este ambiente exige 2FA pra usar o admin. Ative pra continuar.
    </UiAlerta>
    <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

    <!-- códigos de recuperação (mostrados uma vez) -->
    <UiCartao
      v-if="codigosRecuperacao"
      titulo="Códigos de recuperação"
      descricao="Cada um entra uma vez, sem o celular. Guarde num lugar seguro — não aparecem de novo."
    >
      <template #acoes>
        <button type="button" class="text-xs text-wine-tint hover:underline" @click="copiarCodigos">
          copiar
        </button>
      </template>
      <ul class="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
        <li
          v-for="c in codigosRecuperacao"
          :key="c"
          class="rounded-md border border-border bg-bg/60 px-2 py-1.5 text-center"
        >
          {{ c }}
        </li>
      </ul>
      <UiBotao class="mt-4" variante="secundaria" @click="codigosRecuperacao = null"
        >Já guardei</UiBotao
      >
    </UiCartao>

    <!-- estado -->
    <UiCartao v-if="estado" titulo="App autenticador (TOTP)">
      <template #acoes>
        <UiEtiqueta
          :cor="estado.ativo ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'"
        >
          {{ estado.ativo ? 'ativo' : 'desligado' }}
        </UiEtiqueta>
      </template>

      <!-- ligado -->
      <template v-if="estado.ativo">
        <p class="text-sm text-muted">
          Ativo desde {{ dataHora(estado.ativadoEm) }} · {{ estado.codigosRestantes }} código(s) de
          recuperação restante(s).
          <span v-if="estado.codigosRestantes <= 2" class="text-warning">Gere novos.</span>
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <UiBotao variante="secundaria" @click="acao = acao === 'codigos' ? '' : 'codigos'"
            >Novos códigos de recuperação</UiBotao
          >
          <UiBotao variante="fantasma" @click="acao = acao === 'desativar' ? '' : 'desativar'"
            >Desativar 2FA</UiBotao
          >
        </div>
        <form
          v-if="acao === 'codigos'"
          class="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-bg/60 p-3"
          @submit.prevent="novosCodigos"
        >
          <UiCampo
            v-model="codigoAcao"
            rotulo="Código do app"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
          />
          <UiBotao type="submit" :disabled="ocupado || codigoAcao.length < 6">Gerar</UiBotao>
        </form>
        <form
          v-if="acao === 'desativar'"
          class="mt-4 space-y-3 rounded-lg border border-danger/40 bg-danger/5 p-3"
          @submit.prevent="desativar"
        >
          <p class="text-sm">Pra desligar, confirme a senha e um código do app.</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <UiCampo
              v-model="senhaAcao"
              rotulo="Senha atual"
              type="password"
              autocomplete="current-password"
              required
            />
            <UiCampo
              v-model="codigoAcao"
              rotulo="Código do app"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
            />
          </div>
          <UiBotao type="submit" :disabled="ocupado || codigoAcao.length < 6 || !senhaAcao"
            >Desativar</UiBotao
          >
        </form>
      </template>

      <!-- desligado: passo a passo -->
      <template v-else>
        <template v-if="!setup">
          <p class="text-sm text-muted">
            Você vai precisar de um app autenticador no celular (Google Authenticator, Microsoft
            Authenticator, Authy, 1Password…).
          </p>
          <UiBotao class="mt-4" :disabled="ocupado" @click="iniciar"
            >Ativar verificação em duas etapas</UiBotao
          >
        </template>
        <div v-else class="grid gap-5 sm:grid-cols-[220px_1fr]">
          <div>
            <img
              :src="setup.qr"
              alt="QR code do autenticador"
              class="rounded-lg border border-border bg-white p-1"
              width="220"
              height="220"
            />
            <button
              type="button"
              class="mt-2 text-xs text-muted hover:text-text"
              @click="mostrarSegredo = !mostrarSegredo"
            >
              {{ mostrarSegredo ? 'esconder' : 'não consigo ler o QR' }}
            </button>
            <p v-if="mostrarSegredo" class="mt-1 break-all font-mono text-xs">
              {{ setup.segredo }}
            </p>
          </div>
          <form class="space-y-3" @submit.prevent="confirmar">
            <ol class="list-decimal space-y-1 pl-4 text-sm text-muted">
              <li>Abra o app autenticador e escaneie o QR (ou digite o segredo).</li>
              <li>Ele mostra um código de 6 dígitos que muda a cada 30 s.</li>
              <li>Digite o código atual pra confirmar.</li>
            </ol>
            <UiCampo
              v-model="codigoAtivar"
              rotulo="Código do app"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="123456"
              required
            />
            <div class="flex gap-2">
              <UiBotao type="submit" :disabled="ocupado || codigoAtivar.length < 6"
                >Confirmar e ativar</UiBotao
              >
              <UiBotao variante="fantasma" @click="setup = null">Cancelar</UiBotao>
            </div>
          </form>
        </div>
      </template>
    </UiCartao>
  </div>
</template>
