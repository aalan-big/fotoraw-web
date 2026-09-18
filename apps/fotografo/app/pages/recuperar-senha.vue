<script setup lang="ts">
definePageMeta({ layout: 'vazio', middleware: 'convidado' });
useSeoMeta({ title: 'Recuperar senha' });

const api = useApi();
const email = ref('');
const enviando = ref(false);
const enviado = ref(false);
const erro = ref('');

async function enviar() {
  enviando.value = true;
  erro.value = '';
  try {
    await api('/auth/recuperar-senha', { method: 'POST', body: { email: email.value } });
    enviado.value = true;
  } catch (e) {
    erro.value = lerErroApi(e).mensagem;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="card mt-6 space-y-4 p-6">
    <div>
      <h1 class="text-lg font-semibold">Recuperar senha</h1>
      <p class="mt-0.5 text-sm text-muted">A gente manda um link que vale por 30 minutos.</p>
    </div>

    <template v-if="enviado">
      <UiAlerta tipo="sucesso">
        Se <strong>{{ email }}</strong> tiver conta, o link já está a caminho. Confira também o
        spam.
      </UiAlerta>
      <UiBotao to="/entrar" variante="secundaria" class="w-full">Voltar pro login</UiBotao>
    </template>

    <form v-else class="space-y-4" @submit.prevent="enviar">
      <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>
      <UiCampo
        v-model="email"
        rotulo="E-mail da conta"
        type="email"
        autocomplete="email"
        required
      />
      <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">Enviar link</UiBotao>
      <p class="text-center text-sm text-muted">
        <NuxtLink to="/entrar" class="text-wine-tint hover:underline">Lembrei a senha</NuxtLink>
      </p>
    </form>
  </div>
</template>
