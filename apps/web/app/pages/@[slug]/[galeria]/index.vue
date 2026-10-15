<script setup lang="ts">
import { type FotoPublica, type GaleriaAberta, rotuloCategoria } from '~/types/galeria';

// fotoraw.com.br/@conta/galeria — a vitrine de uma galeria.
// Pública abre direto; privada pede o código (vem no link do WhatsApp como
// ?codigo=, ou digitado aqui). Senha, quando o fotógrafo define, vai no
// header e fica só na sessão do navegador.
const rota = useRoute();
const api = useApi();
const carrinho = useCarrinho();

const conta = computed(() => String(rota.params.slug).replace(/^@/, ''));
const slug = computed(() => String(rota.params.galeria));
const codigo = computed(() => (rota.query.codigo ? String(rota.query.codigo) : undefined));
const numero = computed(() => (rota.query.numero ? String(rota.query.numero) : undefined));

const CHAVE_SENHA = 'fotoraw:senha-galeria';
function senhaDaSessao(): string | undefined {
  if (!import.meta.client || !codigo.value) return undefined;
  try {
    return sessionStorage.getItem(`${CHAVE_SENHA}:${codigo.value.toUpperCase()}`) ?? undefined;
  } catch {
    return undefined;
  }
}

function buscarPagina(pagina: number) {
  const senha = senhaDaSessao();
  return api<GaleriaAberta>(`/publico/galerias/${conta.value}/${slug.value}`, {
    query: { codigo: codigo.value, numero: numero.value, pagina },
    headers: senha ? { 'x-senha-galeria': senha } : undefined,
  });
}

const { data: galeria, error, refresh } = await useAsyncData(
  () => `galeria-${conta.value}-${slug.value}-${codigo.value ?? ''}-${numero.value ?? ''}`,
  () => buscarPagina(1),
  { watch: [codigo, numero] },
);

// erro que não é "precisa de código" vira a página de erro do site
const codigoErro = computed(() => (error.value?.data as { codigo?: string } | undefined)?.codigo);
const precisaAcesso = computed(() =>
  ['CODIGO_NECESSARIO', 'CODIGO_INVALIDO', 'SENHA_NECESSARIA', 'SENHA_INVALIDA', 'MUITAS_TENTATIVAS'].includes(
    codigoErro.value ?? '',
  ),
);
if (error.value && !precisaAcesso.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusCode === 404 ? 'Galeria não encontrada' : 'Não foi possível abrir a galeria',
    fatal: true,
  });
}

// --- fotos (primeira página do SSR + "carregar mais") ------------------------
const extras = ref<FotoPublica[]>([]);
const paginaAtual = ref(1);
const carregandoMais = ref(false);
watch(galeria, () => {
  extras.value = [];
  paginaAtual.value = 1;
});
const fotos = computed(() => [...(galeria.value?.fotos.itens ?? []), ...extras.value]);
const temMais = computed(() => !!galeria.value && fotos.value.length < galeria.value.fotos.total);

async function carregarMais() {
  carregandoMais.value = true;
  try {
    const proxima = await buscarPagina(paginaAtual.value + 1);
    extras.value.push(...proxima.fotos.itens);
    paginaAtual.value += 1;
  } finally {
    carregandoMais.value = false;
  }
}

// --- busca por número ----------------------------------------------------------
const busca = ref(numero.value ?? '');
function buscar() {
  const n = busca.value.trim();
  navigateTo({ query: { ...rota.query, numero: n || undefined } });
}

// --- acesso a galeria privada --------------------------------------------------
const formCodigo = ref(codigo.value ?? '');
const formSenha = ref('');
function entrar() {
  const c = formCodigo.value.trim().toUpperCase();
  if (!c) return;
  if (formSenha.value) {
    try {
      sessionStorage.setItem(`${CHAVE_SENHA}:${c}`, formSenha.value);
    } catch {
      // sem sessionStorage a senha não persiste entre páginas, mas o refresh abaixo usa
    }
  }
  if (c === codigo.value?.toUpperCase()) refresh();
  else navigateTo({ query: { ...rota.query, codigo: c } });
}

// --- carrinho / seleção ----------------------------------------------------------
onMounted(() => carrinho.carregar());
const g = computed(() => galeria.value);
const pacote = computed(() => g.value?.modoVenda === 'PACOTE');
const escolhidas = computed(() => (g.value ? carrinho.itens(g.value.id) : []));
const escolhida = (foto: FotoPublica) => !!g.value && carrinho.tem(g.value.id, foto.id);
function alternar(foto: FotoPublica) {
  if (g.value?.podeComprar) carrinho.alternar(g.value.id, foto);
}
// pacote: as N primeiras saem no pacote, o resto paga como extra
const totalCentavos = computed(() => {
  if (!g.value) return 0;
  if (!pacote.value) return carrinho.totalCentavos(g.value.id);
  const extrasPagas = Math.max(0, escolhidas.value.length - (g.value.fotosIncluidas ?? 0));
  return extrasPagas * (g.value.precoFotoCentavos ?? 0);
});

const aberta = ref<number | null>(null);

// --- textos -------------------------------------------------------------------------
const data = computed(() =>
  g.value?.dataEvento
    ? formatarData(g.value.dataEvento, { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null,
);
const local = computed(() => [g.value?.cidade, g.value?.uf].filter(Boolean).join('/'));
const preco = computed(() => {
  const x = g.value;
  if (!x) return null;
  if (x.modoVenda === 'AVULSO' && x.precoFotoCentavos != null) return `${formatarCentavos(x.precoFotoCentavos)} por foto`;
  if (x.modoVenda === 'PACOTE')
    return `${x.fotosIncluidas ?? 0} fotos no pacote${x.precoFotoCentavos != null ? ` · extra ${formatarCentavos(x.precoFotoCentavos)}` : ''}`;
  return null;
});

useSeoMeta({
  title: () => g.value?.titulo ?? 'Galeria',
  description: () =>
    g.value ? `${g.value.titulo} — fotos de ${g.value.fotografo.nome} no FotoRAW.` : 'Galeria privada no FotoRAW.',
  ogImage: () => (g.value?.visibilidade === 'PRIVADA' ? undefined : g.value?.capaUrl ?? undefined),
  robots: () => (g.value?.visibilidade === 'PUBLICA' || g.value?.visibilidade === 'PORTFOLIO' ? 'index, follow' : 'noindex'),
});
</script>

<template>
  <!-- galeria privada: pede o código -->
  <div v-if="precisaAcesso" class="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
    <form class="card space-y-5 p-7 md:p-9" autocomplete="off" @submit.prevent="entrar">
      <div>
        <UiPastilha cor="wine" class="mb-4">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </UiPastilha>
        <h1 class="text-xl font-semibold">Galeria privada</h1>
        <p class="mt-1 text-sm text-muted">Digite o código que o fotógrafo enviou junto com o link.</p>
      </div>

      <input
        v-model="formCodigo"
        type="text"
        autocapitalize="characters"
        spellcheck="false"
        required
        placeholder="LUZ-4821"
        aria-label="Código de acesso"
        class="h-14 w-full rounded-lg border border-border bg-bg px-4 text-center text-2xl font-bold uppercase tracking-[0.25em] outline-none placeholder:text-muted/40 focus:border-wine focus:ring-2 focus:ring-wine-dim"
      />
      <input
        v-if="codigoErro === 'SENHA_NECESSARIA' || codigoErro === 'SENHA_INVALIDA'"
        v-model="formSenha"
        type="password"
        autocomplete="new-password"
        placeholder="Senha da galeria"
        aria-label="Senha da galeria"
        class="h-12 w-full rounded-lg border border-border bg-bg px-4 outline-none placeholder:text-muted/50 focus:border-wine focus:ring-2 focus:ring-wine-dim"
      />

      <p v-if="codigoErro && codigoErro !== 'CODIGO_NECESSARIO'" class="text-sm text-danger">
        {{ (error?.data as { mensagem?: string } | undefined)?.mensagem }}
      </p>

      <UiBotao type="submit" tamanho="lg" class="w-full">Abrir galeria</UiBotao>
    </form>
  </div>

  <div v-else-if="g" class="pb-28">
    <!-- cabeçalho com a capa ao fundo -->
    <section class="relative overflow-hidden border-b border-border">
      <img
        v-if="g.capaUrl"
        :src="g.capaUrl"
        alt=""
        class="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-2xl"
        aria-hidden="true"
      />
      <div class="absolute inset-0 bg-linear-to-b from-bg/40 to-bg" />
      <div class="relative mx-auto max-w-6xl px-6 pb-10 pt-12 md:pt-16">
        <div class="flex flex-wrap items-center gap-2.5">
          <span class="rounded-md bg-wine px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            {{ rotuloCategoria[g.categoria] }}
          </span>
          <span v-if="data" class="text-sm text-text/80">{{ data }}</span>
          <span v-if="local" class="text-sm text-text/80">· {{ local }}</span>
        </div>
        <h1 class="mt-3 text-3xl font-bold uppercase tracking-tight md:text-5xl">{{ g.titulo }}</h1>
        <p v-if="g.descricao" class="mt-3 max-w-2xl text-muted">{{ g.descricao }}</p>

        <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <NuxtLink :to="`/@${g.fotografo.slug}`" class="flex items-center gap-2.5 hover:text-wine-tint">
            <img v-if="g.fotografo.logoUrl" :src="g.fotografo.logoUrl" alt="" class="size-8 rounded-full object-cover" />
            <span
              v-else
              class="flex size-8 items-center justify-center rounded-full bg-wine-dim text-xs font-bold text-wine-tint"
            >
              {{ iniciais(g.fotografo.nome) }}
            </span>
            <span class="font-medium">{{ g.fotografo.nome }}</span>
          </NuxtLink>
          <span class="text-muted">{{ g.totalFotos }} {{ g.totalFotos === 1 ? 'foto' : 'fotos' }}</span>
          <span v-if="preco" class="font-semibold text-wine-tint">{{ preco }}</span>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-6xl px-6 pt-8">
      <!-- avisos de situação -->
      <div v-if="g.situacao === 'ENCERRADA'" class="card p-8 text-center">
        <p class="text-lg font-semibold">Esta galeria foi encerrada</p>
        <p class="mt-1 text-sm text-muted">As fotos não estão mais disponíveis. Fale com o fotógrafo se precisar de alguma.</p>
      </div>
      <p
        v-else-if="g.situacao === 'PAUSADA'"
        class="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
      >
        As vendas desta galeria estão pausadas no momento. Você pode ver as fotos e voltar depois.
      </p>
      <p
        v-else-if="g.modoVenda === 'ENTREGA'"
        class="mb-6 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm text-info"
      >
        Suas fotos estão aqui. O download em alta resolução chega em breve nesta mesma página.
      </p>

      <template v-if="g.situacao !== 'ENCERRADA'">
        <!-- busca por número (eventos) -->
        <form
          v-if="g.modalidade === 'EVENTO'"
          class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center"
          @submit.prevent="buscar"
        >
          <input
            v-model="busca"
            type="search"
            inputmode="numeric"
            placeholder="Seu número de peito"
            aria-label="Buscar pelo número"
            class="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm outline-none placeholder:text-muted/70 focus:border-wine sm:w-64"
          />
          <UiBotao type="submit" variante="secundaria" class="h-11">Buscar</UiBotao>
          <button
            v-if="numero"
            type="button"
            class="text-sm text-muted underline-offset-4 hover:text-text hover:underline"
            @click="busca = ''; buscar()"
          >
            Ver todas
          </button>
        </form>

        <p v-if="numero" class="mb-4 text-sm text-muted">
          {{ g.fotos.total }} {{ g.fotos.total === 1 ? 'foto' : 'fotos' }} com o número {{ numero }}
        </p>

        <div v-if="!fotos.length" class="card p-10 text-center text-muted">
          {{ numero ? 'Nenhuma foto com esse número ainda. Tente sem o número e procure pela grade.' : 'Nenhuma foto por aqui ainda.' }}
        </div>

        <!-- grade -->
        <div class="columns-2 gap-3 md:columns-3 lg:columns-4">
          <figure
            v-for="(foto, i) in fotos"
            :key="foto.id"
            class="group relative mb-3 cursor-zoom-in break-inside-avoid overflow-hidden rounded-lg border bg-surface"
            :class="escolhida(foto) ? 'border-wine ring-2 ring-wine' : 'border-border'"
            @click="aberta = i"
          >
            <img
              :src="foto.miniaturaUrl ?? foto.url ?? ''"
              :width="foto.largura ?? undefined"
              :height="foto.altura ?? undefined"
              :alt="foto.numero ? `Foto nº ${foto.numero}` : `Foto ${i + 1}`"
              loading="lazy"
              draggable="false"
              class="pointer-events-none h-auto w-full select-none transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <!-- camada transparente: "salvar imagem" pega o vazio, não a foto -->
            <span class="absolute inset-0" aria-hidden="true" @contextmenu.prevent />
            <span
              v-if="foto.numero"
              class="absolute left-2 top-2 rounded bg-bg/75 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur"
            >
              {{ foto.numero }}
            </span>
            <button
              v-if="g.podeComprar"
              type="button"
              class="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full backdrop-blur transition-colors"
              :class="escolhida(foto) ? 'bg-wine text-white' : 'bg-bg/70 text-text hover:bg-wine'"
              :aria-label="escolhida(foto) ? 'Tirar do carrinho' : 'Adicionar ao carrinho'"
              @click.stop="alternar(foto)"
            >
              <svg v-if="escolhida(foto)" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 12l5 5L19 7" />
              </svg>
              <svg v-else class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </figure>
        </div>

        <div v-if="temMais" class="mt-8 flex justify-center">
          <UiBotao variante="secundaria" :disabled="carregandoMais" @click="carregarMais">
            {{ carregandoMais ? 'Carregando…' : 'Carregar mais fotos' }}
          </UiBotao>
        </div>
      </template>
    </div>

    <GaleriaVisualizador
      v-model="aberta"
      :fotos="fotos"
      :pode-comprar="g.podeComprar"
      :pacote="pacote"
      :escolhida="escolhida"
      @alternar="alternar"
    />

    <!-- barra do carrinho -->
    <ClientOnly>
      <div
        v-if="g.podeComprar && escolhidas.length"
        class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
      >
        <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div class="min-w-0">
            <p class="font-semibold">
              <template v-if="pacote">
                {{ escolhidas.length }} de {{ g.fotosIncluidas ?? 0 }} fotos do pacote
              </template>
              <template v-else>
                {{ escolhidas.length }} {{ escolhidas.length === 1 ? 'foto' : 'fotos' }}
              </template>
              <span v-if="totalCentavos" class="tabular-nums text-wine-tint"> · {{ formatarCentavos(totalCentavos) }}</span>
            </p>
            <p class="text-xs text-muted">Pagamento por Pix ou cartão chega em breve.</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UiBotao variante="fantasma" @click="carrinho.limpar(g.id)">Limpar</UiBotao>
            <UiBotao disabled>{{ pacote ? 'Confirmar escolha' : 'Finalizar compra' }}</UiBotao>
          </div>
        </div>
      </div>
    </ClientOnly>
  </div>
</template>
