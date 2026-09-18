<script setup lang="ts">
definePageMeta({ layout: 'cadastro', middleware: 'convidado' });
useSeoMeta({ title: 'Criar conta' });

const sessao = useSessao();
const form = reactive({ nome: '', email: '', senha: '', slug: '' });
const enviando = ref(false);
const erro = ref('');
const erros = ref<Record<string, string>>({});
const slugEditado = ref(false);
const mostrarSenha = ref(false);

function slugDe(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 30);
}

/** Sugere o @endereço a partir do nome até a pessoa mexer no campo. */
watch(
  () => form.nome,
  (nome) => {
    if (!slugEditado.value) form.slug = slugDe(nome).replace(/-+$/, '');
  },
);
function editarSlug(e: Event) {
  slugEditado.value = true;
  form.slug = slugDe((e.target as HTMLInputElement).value);
}

/** Força da senha: só orientação, a regra de verdade está no server. */
const forca = computed(() => {
  const s = form.senha;
  if (!s) return { nivel: 0, rotulo: '' };
  let pontos = 0;
  if (s.length >= 8) pontos += 1;
  if (s.length >= 12) pontos += 1;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) pontos += 1;
  if (/\d/.test(s)) pontos += 1;
  if (/[^A-Za-z0-9]/.test(s)) pontos += 1;
  if (s.length >= 16) pontos += 1;
  if (s.length < 8) return { nivel: 1, rotulo: 'muito curta' };
  if (pontos <= 2) return { nivel: 2, rotulo: 'fraca' };
  if (pontos <= 4) return { nivel: 3, rotulo: 'boa' };
  return { nivel: 4, rotulo: 'forte' };
});
const corForca = ['', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success'];

async function enviar() {
  enviando.value = true;
  erro.value = '';
  erros.value = {};
  try {
    await sessao.cadastrar({ ...form, slug: form.slug.replace(/-+$/, '') });
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
  <form class="card space-y-5 p-6 shadow-2xl shadow-black/40 sm:p-8" @submit.prevent="enviar">
    <div>
      <h1 class="text-xl font-semibold">Criar conta</h1>
      <p class="mt-1 text-sm text-muted">
        Leva um minuto. Já tem conta?
        <NuxtLink to="/entrar" class="text-wine-tint hover:underline">Entrar</NuxtLink>
      </p>
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

    <!-- endereço com o prefixo dentro do campo -->
    <label class="block">
      <span class="rotulo">Seu endereço</span>
      <span
        class="campo flex items-center gap-0 px-0 focus-within:border-wine focus-within:ring-2 focus-within:ring-wine-dim"
        :class="{ 'border-danger': erros.slug }"
      >
        <span class="select-none whitespace-nowrap pl-3 text-sm text-muted">fotoraw.com.br/@</span>
        <input
          :value="form.slug"
          required
          maxlength="30"
          autocomplete="off"
          spellcheck="false"
          placeholder="estudio-luz"
          class="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none placeholder:text-muted/60"
          @input="editarSlug"
        />
      </span>
      <span v-if="erros.slug" class="mt-1 block text-xs text-danger">{{ erros.slug }}</span>
      <span v-else class="mt-1 block text-xs text-muted">
        Letras, números e hífen. Não dá pra mudar depois de publicar.
      </span>
    </label>

    <UiCampo
      v-model="form.email"
      rotulo="E-mail"
      type="email"
      autocomplete="email"
      required
      :erro="erros.email"
      placeholder="voce@estudio.com.br"
      ajuda="Vai ser seu login na web e no desktop."
    />

    <!-- senha com mostrar/ocultar e medidor -->
    <label class="block">
      <span class="rotulo flex items-center justify-between">
        Senha
        <button
          type="button"
          class="normal-case tracking-normal text-wine-tint hover:underline"
          @click="mostrarSenha = !mostrarSenha"
        >
          {{ mostrarSenha ? 'Ocultar' : 'Mostrar' }}
        </button>
      </span>
      <input
        v-model="form.senha"
        :type="mostrarSenha ? 'text' : 'password'"
        autocomplete="new-password"
        required
        minlength="8"
        class="campo"
        :class="{ 'border-danger': erros.senha }"
        placeholder="uma frase que só você lembra"
      />
      <div class="mt-2 flex items-center gap-2" aria-hidden="true">
        <span
          v-for="i in 4"
          :key="i"
          class="h-1 flex-1 rounded-full transition-colors"
          :class="i <= forca.nivel ? corForca[forca.nivel] : 'bg-surface-2'"
        />
      </div>
      <span v-if="erros.senha" class="mt-1 block text-xs text-danger">{{ erros.senha }}</span>
      <span v-else class="mt-1 block text-xs text-muted">
        <template v-if="forca.rotulo">Senha {{ forca.rotulo }}. </template>
        Pelo menos 8 caracteres — uma frase é mais fácil de lembrar e mais difícil de adivinhar.
      </span>
    </label>

    <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">
      {{ enviando ? 'Criando…' : 'Criar conta grátis' }}
    </UiBotao>

    <p class="text-center text-xs text-muted/80">
      Ao criar a conta você concorda com os
      <a :href="`${$config.public.webUrl}/termos`" class="underline-offset-2 hover:underline"
        >termos</a
      >
      e a
      <a :href="`${$config.public.webUrl}/privacidade`" class="underline-offset-2 hover:underline">
        política de privacidade</a
      >.
    </p>
  </form>
</template>
