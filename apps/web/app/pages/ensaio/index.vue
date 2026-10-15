<script setup lang="ts">
definePageMeta({ layout: 'vazio' });
useSeoMeta({
  title: 'Acessar meu ensaio',
  description: 'Entre na sua galeria privada com o código que o fotógrafo enviou.',
});

// Quem tem só o código: POST /publico/acesso devolve a galeria e a gente
// leva pra /@conta/galeria?codigo=. A senha (quando o fotógrafo definiu) fica
// só na sessão do navegador — a página da galeria manda no header.
const api = useApi();
const codigo = ref('');
const senha = ref('');
const erro = ref('');
const entrando = ref(false);

async function entrar() {
  erro.value = '';
  entrando.value = true;
  try {
    const r = await api<{ contaSlug: string; galeriaSlug: string; codigo: string }>('/publico/acesso', {
      method: 'POST',
      body: { codigo: codigo.value, senha: senha.value || undefined },
    });
    if (senha.value) {
      try {
        sessionStorage.setItem(`fotoraw:senha-galeria:${r.codigo}`, senha.value);
      } catch {
        // sem sessionStorage: a galeria pede a senha de novo
      }
    }
    await navigateTo({ path: `/@${r.contaSlug}/${r.galeriaSlug}`, query: { codigo: r.codigo } });
  } catch (e) {
    const dados = (e as { data?: { mensagem?: string } }).data;
    erro.value = dados?.mensagem ?? 'Não foi possível abrir a galeria. Tente de novo.';
  } finally {
    entrando.value = false;
  }
}

const beneficios = [
  ['Só você vê', 'Galeria privada, com código e senha. Ninguém acha por busca.'],
  ['Escolha com calma', 'Marque as favoritas do seu pacote e adicione extras se quiser.'],
  ['Alta resolução', 'As escolhidas chegam finalizadas, sem marca d’água, na mesma galeria.'],
];
</script>

<template>
  <div class="relative min-h-dvh overflow-hidden">
    <div class="absolute inset-0 bg-[url(/imagens/fundo-login.jpg)] bg-cover bg-center" />
    <div class="absolute inset-0 bg-linear-to-r from-bg/95 via-bg/80 to-bg/60" />

    <div class="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-8">
      <header class="flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center">
          <UiLogo variante="wordmark" />
        </NuxtLink>
        <NuxtLink to="/" class="text-sm text-muted transition-colors hover:text-text">
          ← Voltar pro início
        </NuxtLink>
      </header>

      <div class="grid flex-1 items-center gap-12 py-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <!-- lado esquerdo: contexto -->
        <div class="max-w-lg">
          <p class="text-sm font-medium uppercase tracking-[0.2em] text-wine-tint">Seu ensaio</p>
          <h1 class="mt-3 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Suas fotos estão prontas pra você escolher.
          </h1>
          <p class="mt-5 text-lg leading-relaxed text-muted">
            O fotógrafo te mandou um link ou um código. Se abriu pelo link, você já está dentro; se
            tem só o código, é aqui.
          </p>

          <ul class="mt-10 space-y-5">
            <li v-for="([titulo, texto], i) in beneficios" :key="titulo" class="flex gap-4">
              <UiPastilha cor="wine" class="size-9 shrink-0">
                <span class="text-sm font-bold">{{ i + 1 }}</span>
              </UiPastilha>
              <div>
                <p class="font-semibold">{{ titulo }}</p>
                <p class="mt-0.5 text-sm text-muted">{{ texto }}</p>
              </div>
            </li>
          </ul>
        </div>

        <!-- lado direito: formulário -->
        <form
          class="card mx-auto w-full max-w-md space-y-5 p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] md:p-9"
          autocomplete="off"
          @submit.prevent="entrar"
        >
          <div>
            <h2 class="text-xl font-semibold">Acessar minha galeria</h2>
            <p class="mt-1 text-sm text-muted">Digite o código que veio na mensagem.</p>
          </div>

          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
              Código do ensaio
            </span>
            <input
              v-model="codigo"
              type="text"
              name="codigo-ensaio"
              inputmode="text"
              autocomplete="one-time-code"
              autocapitalize="characters"
              spellcheck="false"
              required
              placeholder="LUZ-4821"
              class="h-14 w-full rounded-lg border border-border bg-bg px-4 text-center text-2xl font-bold uppercase tracking-[0.25em] outline-none placeholder:text-muted/40 focus:border-wine focus:ring-2 focus:ring-wine-dim"
            />
          </label>

          <label class="block">
            <span
              class="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Senha
              <span class="font-normal normal-case tracking-normal text-muted/70">
                se o fotógrafo definiu
              </span>
            </span>
            <input
              v-model="senha"
              type="password"
              name="senha-ensaio"
              autocomplete="new-password"
              placeholder="••••••"
              class="h-12 w-full rounded-lg border border-border bg-bg px-4 outline-none placeholder:text-muted/50 focus:border-wine focus:ring-2 focus:ring-wine-dim"
            />
          </label>

          <p v-if="erro" class="text-sm text-danger">{{ erro }}</p>

          <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="entrando">
            {{ entrando ? 'Abrindo…' : 'Abrir minha galeria' }}
          </UiBotao>

          <p class="text-center text-xs leading-relaxed text-muted/80">
            Não achou o código? Está na mensagem do fotógrafo, junto com o link. A galeria é privada
            e só ele pode reenviar.
          </p>
        </form>
      </div>
    </div>
  </div>
</template>
