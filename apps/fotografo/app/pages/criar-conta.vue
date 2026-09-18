<script setup lang="ts">
definePageMeta({ layout: 'vazio', middleware: 'convidado' });
useSeoMeta({ title: 'Criar conta' });

const sessao = useSessao();
const form = reactive({ nome: '', email: '', senha: '', slug: '' });
const enviando = ref(false);
const erro = ref('');
const erros = ref<Record<string, string>>({});
const slugEditado = ref(false);

/** Sugere o @slug a partir do nome até a pessoa mexer no campo. */
watch(
  () => form.nome,
  (nome) => {
    if (slugEditado.value) return;
    form.slug = nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
  },
);

async function enviar() {
  enviando.value = true;
  erro.value = '';
  erros.value = {};
  try {
    await sessao.cadastrar({ ...form });
    await navigateTo('/');
  } catch (e) {
    const apiErro = lerErroApi(e);
    erros.value = errosPorCampo(apiErro);
    if (apiErro.codigo === 'EMAIL_JA_CADASTRADO') erros.value.email = apiErro.mensagem;
    else if (apiErro.codigo === 'SLUG_JA_USADO') erros.value.slug = apiErro.mensagem;
    else if (apiErro.codigo === 'SENHA_FRACA') erros.value.senha = apiErro.mensagem;
    else if (!apiErro.erros?.length) erro.value = apiErro.mensagem;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <form class="card mt-6 space-y-4 p-6" @submit.prevent="enviar">
    <div>
      <h1 class="text-lg font-semibold">Criar conta</h1>
      <p class="mt-0.5 text-sm text-muted">14 dias de PRO grátis. Sem cartão.</p>
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>

    <UiCampo
      v-model="form.nome"
      rotulo="Nome ou estúdio"
      autocomplete="organization"
      required
      :erro="erros.nome"
      placeholder="Estúdio Luz"
    />
    <UiCampo
      v-model="form.slug"
      rotulo="Seu endereço"
      :erro="erros.slug"
      ajuda="fotoraw.com.br/@seu-endereco — não dá pra mudar depois de publicar"
      required
      :maxlength="30"
      placeholder="estudio-luz"
      @update:model-value="slugEditado = true"
    />
    <UiCampo
      v-model="form.email"
      rotulo="E-mail"
      type="email"
      autocomplete="email"
      required
      :erro="erros.email"
      placeholder="voce@estudio.com.br"
    />
    <UiCampo
      v-model="form.senha"
      rotulo="Senha"
      type="password"
      autocomplete="new-password"
      required
      :erro="erros.senha"
      ajuda="Pelo menos 8 caracteres. Uma frase é mais fácil de lembrar e mais difícil de adivinhar."
    />

    <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">
      {{ enviando ? 'Criando…' : 'Criar conta' }}
    </UiBotao>

    <p class="text-center text-sm text-muted">
      Já tem conta?
      <NuxtLink to="/entrar" class="text-wine-tint hover:underline">Entrar</NuxtLink>
    </p>
  </form>
</template>
