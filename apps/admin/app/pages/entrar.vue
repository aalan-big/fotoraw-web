<script setup lang="ts">
definePageMeta({ layout: 'vazio', middleware: 'convidado' });
useSeoMeta({ title: 'Entrar' });

const sessao = useSessao();
const rota = useRoute();
const email = ref('');
const senha = ref('');
const enviando = ref(false);
const erro = ref(rota.query.semPermissao ? 'Esta conta não é de administrador.' : '');
/** 2FA ligado: senha passou, falta o código */
const desafio = ref<string | null>(null);
const codigo = ref('');

function concluir() {
  const voltar = typeof rota.query.voltar === 'string' ? rota.query.voltar : '/';
  return navigateTo(voltar.startsWith('/') ? voltar : '/');
}

async function enviar() {
  enviando.value = true;
  erro.value = '';
  try {
    if (desafio.value) {
      await sessao.confirmar2fa(desafio.value, codigo.value);
      await concluir();
      return;
    }
    const r = await sessao.entrar(email.value, senha.value);
    if (r) {
      desafio.value = r.desafio;
      codigo.value = '';
      return;
    }
    await concluir();
  } catch (e) {
    const falha = lerErroApi(e);
    erro.value =
      falha.codigo === 'PAINEL_ERRADO' ? 'Esta conta não é de administrador.' : falha.mensagem;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <form class="card mt-6 space-y-4 p-6" @submit.prevent="enviar">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold">Gestão da plataforma</h1>
        <p class="mt-0.5 text-sm text-muted">Acesso restrito a administradores.</p>
      </div>
      <span
        class="rounded-md bg-wine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white"
        >admin</span
      >
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>

    <template v-if="desafio">
      <p class="text-sm text-muted">
        Abra o app autenticador e digite o código de 6 dígitos. Sem o celular, use um dos códigos de
        recuperação.
      </p>
      <UiCampo
        v-model="codigo"
        rotulo="Código"
        inputmode="numeric"
        autocomplete="one-time-code"
        placeholder="123 456 ou XXXX-XXXX"
        required
      />
      <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando || codigo.length < 6">
        {{ enviando ? 'Conferindo…' : 'Confirmar' }}
      </UiBotao>
      <button
        type="button"
        class="w-full text-center text-xs text-muted hover:text-text"
        @click="
          desafio = null;
          erro = '';
        "
      >
        voltar
      </button>
    </template>
    <template v-else>
      <UiCampo v-model="email" rotulo="E-mail" type="email" autocomplete="username" required />
      <UiCampo
        v-model="senha"
        rotulo="Senha"
        type="password"
        autocomplete="current-password"
        required
      />

      <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">
        {{ enviando ? 'Entrando…' : 'Entrar' }}
      </UiBotao>
    </template>
  </form>
</template>
