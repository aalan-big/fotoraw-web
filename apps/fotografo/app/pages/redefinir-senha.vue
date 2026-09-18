<script setup lang="ts">
definePageMeta({ layout: 'vazio' });
useSeoMeta({ title: 'Nova senha' });

const api = useApi();
const rota = useRoute();
const token = computed(() => (typeof rota.query.token === 'string' ? rota.query.token : ''));
const senha = ref('');
const confirmacao = ref('');
const enviando = ref(false);
const pronto = ref(false);
const erro = ref('');

async function enviar() {
  if (senha.value !== confirmacao.value) {
    erro.value = 'As senhas não são iguais';
    return;
  }
  enviando.value = true;
  erro.value = '';
  try {
    await api('/auth/redefinir-senha', {
      method: 'POST',
      body: { token: token.value, senha: senha.value },
    });
    pronto.value = true;
  } catch (e) {
    const apiErro = lerErroApi(e);
    erro.value = errosPorCampo(apiErro).senha ?? apiErro.mensagem;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="card mt-6 space-y-4 p-6">
    <div>
      <h1 class="text-lg font-semibold">Escolher nova senha</h1>
      <p class="mt-0.5 text-sm text-muted">Todas as sessões e o desktop vão pedir login de novo.</p>
    </div>

    <UiAlerta v-if="!token" tipo="erro">Link inválido. Peça outro em "Esqueci a senha".</UiAlerta>

    <template v-else-if="pronto">
      <UiAlerta tipo="sucesso">Senha alterada. Entre com a nova.</UiAlerta>
      <UiBotao to="/entrar" class="w-full">Entrar</UiBotao>
    </template>

    <form v-else class="space-y-4" @submit.prevent="enviar">
      <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>
      <UiCampo
        v-model="senha"
        rotulo="Nova senha"
        type="password"
        autocomplete="new-password"
        required
        ajuda="Pelo menos 8 caracteres"
      />
      <UiCampo
        v-model="confirmacao"
        rotulo="Repita a senha"
        type="password"
        autocomplete="new-password"
        required
      />
      <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">Salvar senha</UiBotao>
    </form>
  </div>
</template>
