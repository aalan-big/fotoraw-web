<script setup lang="ts">
import type { Pedido } from '~/types/pedido';

// /pedido/:id — pagar (Pix ou cartão), acompanhar e, depois de pago, baixar as fotos.
// É o link que vai no e-mail do comprador. Enquanto espera o Pix, consulta a cada
// poucos segundos (o server também confirma direto com o Mercado Pago).
useSeoMeta({ title: 'Seu pedido', robots: 'noindex' });

const rota = useRoute();
const api = useApi();
const carrinho = useCarrinho();
const id = String(rota.params.id);

const { data: pedido, error, refresh } = await useAsyncData(`pedido-${id}`, () => api<Pedido>(`/publico/pedidos/${id}`));
if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Pedido não encontrado', fatal: true });
}

const p = computed(() => pedido.value!);
const voltaGaleria = computed(() => `/@${p.value.galeria.contaSlug}/${p.value.galeria.slug}`);
const aPagar = computed(() => ['ABERTO', 'AGUARDANDO_PAGAMENTO'].includes(p.value.status));

// --- acompanhamento ---------------------------------------------------------------
let timer: ReturnType<typeof setInterval> | null = null;
function acompanhar() {
  if (timer || !import.meta.client) return;
  timer = setInterval(async () => {
    await refresh();
    if (!aPagar.value && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, 4000);
}
onUnmounted(() => timer && clearInterval(timer));

onMounted(() => {
  carrinho.carregar();
  if (p.value.pix) acompanhar();
});
// pagou: limpa o carrinho daquela galeria
watch(
  () => p.value.status,
  (s) => {
    if (s === 'PAGO') carrinho.limpar(p.value.galeria.id);
  },
  { immediate: true },
);

// --- Pix --------------------------------------------------------------------------
const metodo = ref<'pix' | 'cartao'>('pix');
const gerando = ref(false);
const erro = ref('');
async function gerarPix() {
  erro.value = '';
  gerando.value = true;
  try {
    pedido.value = await api<Pedido>(`/publico/pedidos/${id}/pix`, { method: 'POST' });
    acompanhar();
  } catch (e) {
    erro.value = (e as { data?: { mensagem?: string } }).data?.mensagem ?? 'Não foi possível gerar o Pix. Tente de novo.';
  } finally {
    gerando.value = false;
  }
}
const copiado = ref(false);
async function copiarPix() {
  if (!p.value.pix?.copiaCola) return;
  await navigator.clipboard.writeText(p.value.pix.copiaCola);
  copiado.value = true;
  setTimeout(() => (copiado.value = false), 2500);
}
const agora = ref(Date.now());
let relogio: ReturnType<typeof setInterval> | null = null;
onMounted(() => (relogio = setInterval(() => (agora.value = Date.now()), 1000)));
onUnmounted(() => relogio && clearInterval(relogio));
const restante = computed(() => {
  const fim = p.value.pix?.expiraEm ? new Date(p.value.pix.expiraEm).getTime() : 0;
  const s = Math.max(0, Math.floor((fim - agora.value) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
});

// --- cartão -----------------------------------------------------------------------
const cartao = useCartaoMercadoPago();
const cartaoAberto = ref(false);
async function abrirCartao() {
  erro.value = '';
  metodo.value = 'cartao';
  if (!p.value.publicKey) {
    erro.value = 'O pagamento com cartão não está disponível para este fotógrafo. Use o Pix.';
    return;
  }
  cartaoAberto.value = true;
  await nextTick();
  await cartao.montar({
    container: 'cartao-mp',
    chavePublica: p.value.publicKey,
    valor: p.value.totalCentavos / 100,
    email: p.value.comprador.email,
    onErro: (m) => (erro.value = m),
    onCartao: async (dados) => {
      erro.value = '';
      try {
        const r = await api<Pedido>(`/publico/pedidos/${id}/cartao`, { method: 'POST', body: dados });
        pedido.value = r;
        if (r.status !== 'PAGO') {
          if (r.cartao?.status === 'rejected') {
            erro.value = 'O cartão foi recusado. Confira os dados, tente outro cartão ou pague com Pix.';
            await abrirCartao(); // formulário novo (o token do cartão é de uso único)
          } else {
            acompanhar(); // em análise: o MP confirma em seguida
          }
        }
      } catch (e) {
        erro.value = (e as { data?: { mensagem?: string } }).data?.mensagem ?? 'Não foi possível pagar com o cartão.';
      }
    },
  });
}
function escolherPix() {
  metodo.value = 'pix';
  cartaoAberto.value = false;
  cartao.desmontar();
}

// --- downloads --------------------------------------------------------------------
// Link de verdade (funciona mesmo antes do JavaScript carregar, e dentro do app de
// e-mail): o server conta a baixada e redireciona pro arquivo. No iPhone/iPad a foto
// abre na tela (tocar e segurar → Salvar na Fotos); no resto, baixa como arquivo.
const { apiBase } = useRuntimeConfig().public;
const ios = ref(false);
onMounted(() => {
  ios.value =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
});
function linkArquivo(token: string) {
  return `${apiBase}/publico/downloads/${token}/arquivo${ios.value ? '?modo=ver' : ''}`;
}
// volta pra aba: atualiza o contador de downloads restantes
onMounted(() => document.addEventListener('visibilitychange', aoVoltar));
onUnmounted(() => document.removeEventListener('visibilitychange', aoVoltar));
function aoVoltar() {
  if (document.visibilityState === 'visible' && p.value.status === 'PAGO') refresh();
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-12">
    <NuxtLink :to="voltaGaleria" class="text-sm text-muted hover:text-text">← {{ p.galeria.titulo }}</NuxtLink>
    <div class="mt-3 flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-3xl font-bold tracking-tight">Pedido #{{ p.numero }}</h1>
      <span class="text-lg font-semibold tabular-nums text-wine-tint">{{ formatarCentavos(p.totalCentavos) }}</span>
    </div>
    <p class="mt-1 text-sm text-muted">
      {{ p.itens.length }} {{ p.itens.length === 1 ? 'foto' : 'fotos' }} de {{ p.galeria.fotografo }}
    </p>

    <!-- pago: downloads -->
    <section v-if="p.status === 'PAGO'" class="mt-8">
      <div class="card flex items-center gap-4 border-success/40 p-5">
        <UiPastilha cor="success">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12l5 5L19 7" />
          </svg>
        </UiPastilha>
        <div>
          <p class="font-semibold">{{ p.totalCentavos === 0 ? 'Seleção confirmada!' : 'Pagamento confirmado!' }}</p>
          <p class="text-sm text-muted">Suas fotos em alta resolução, sem marca d'água. Também mandamos este link para {{ p.comprador.email }}.</p>
        </div>
      </div>
      <p class="mt-4 text-sm text-muted">
        Pode baixar sempre que quiser. Todas as suas compras ficam em
        <NuxtLink to="/minhas-fotos" class="text-wine-tint underline-offset-4 hover:underline">Minhas fotos</NuxtLink>
        — é só entrar com este e-mail.
      </p>
      <p v-if="ios" class="mt-2 text-sm text-muted">
        No iPhone a foto abre na tela: toque e segure nela e escolha <strong class="text-text">Salvar na Fotos</strong>.
      </p>
      <ul class="mt-6 grid gap-4 sm:grid-cols-2">
        <li v-for="item in p.itens" :key="item.fotoId" class="card flex items-center gap-4 p-3">
          <img v-if="item.miniaturaUrl" :src="item.miniaturaUrl" alt="" class="size-20 shrink-0 rounded-md object-cover" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ item.numero ? `Foto nº ${item.numero}` : 'Foto' }}</p>
            <p class="text-xs text-muted">Alta resolução · sem marca</p>
          </div>
          <a
            v-if="item.download && item.download.baixadas < item.download.limite"
            :href="linkArquivo(item.download.token)"
            target="_blank"
            rel="noopener"
            class="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 px-4 text-sm font-medium text-text transition-colors hover:border-muted/40"
          >
            {{ ios ? 'Abrir foto' : 'Baixar' }}
          </a>
          <span v-else-if="item.download" class="text-xs text-muted">Limite atingido</span>
        </li>
      </ul>
    </section>

    <!-- a pagar -->
    <section v-else-if="aPagar" class="mt-8">
      <ul class="flex gap-2 overflow-x-auto pb-1">
        <li v-for="item in p.itens" :key="item.fotoId" class="size-16 shrink-0 overflow-hidden rounded-md bg-surface-2">
          <img v-if="item.miniaturaUrl" :src="item.miniaturaUrl" alt="" class="size-full object-cover" />
        </li>
      </ul>

      <div class="mt-6 flex gap-2">
        <button
          type="button"
          class="h-11 flex-1 rounded-lg border text-sm font-semibold transition-colors"
          :class="metodo === 'pix' ? 'border-wine bg-wine-dim text-text' : 'border-border text-muted hover:text-text'"
          @click="escolherPix"
        >
          Pix
        </button>
        <button
          type="button"
          class="h-11 flex-1 rounded-lg border text-sm font-semibold transition-colors"
          :class="metodo === 'cartao' ? 'border-wine bg-wine-dim text-text' : 'border-border text-muted hover:text-text'"
          @click="abrirCartao"
        >
          Cartão de crédito
        </button>
      </div>

      <p v-if="erro" class="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{{ erro }}</p>

      <!-- Pix -->
      <div v-if="metodo === 'pix'" class="card mt-4 p-6 text-center">
        <template v-if="p.pix">
          <p class="font-semibold">Escaneie o QR Code no app do seu banco</p>
          <img
            v-if="p.pix.qrBase64"
            :src="`data:image/png;base64,${p.pix.qrBase64}`"
            alt="QR Code do Pix"
            class="mx-auto mt-4 size-56 rounded-lg bg-white p-2"
          />
          <p class="mt-4 text-sm text-muted">ou use o Pix copia e cola:</p>
          <div class="mt-2 flex gap-2">
            <input :value="p.pix.copiaCola ?? ''" readonly class="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-xs text-muted" />
            <UiBotao variante="secundaria" class="h-11" @click="copiarPix">{{ copiado ? 'Copiado!' : 'Copiar' }}</UiBotao>
          </div>
          <p class="mt-5 flex items-center justify-center gap-2 text-sm text-muted">
            <span class="size-2 animate-pulse rounded-full bg-warning" />
            Aguardando o pagamento · expira em <span class="tabular-nums">{{ restante }}</span>
          </p>
          <p class="mt-1 text-xs text-muted/80">Esta página atualiza sozinha quando o pagamento cair.</p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">Na hora, aprovação automática. O QR Code vale por 30 minutos.</p>
          <UiBotao class="mt-4" tamanho="lg" :disabled="gerando" @click="gerarPix">
            {{ gerando ? 'Gerando…' : `Gerar Pix de ${formatarCentavos(p.totalCentavos)}` }}
          </UiBotao>
        </template>
      </div>

      <!-- cartão -->
      <div v-show="metodo === 'cartao' && cartaoAberto" class="mt-4">
        <div id="cartao-mp" />
      </div>

      <p class="mt-6 text-center text-xs text-muted/80">
        Pagamento processado pelo Mercado Pago. O FotoRAW não vê nem guarda os dados do seu cartão.
      </p>
    </section>

    <!-- expirado / cancelado / estornado -->
    <section v-else class="card mt-8 p-8 text-center">
      <p class="text-lg font-semibold">
        {{ p.status === 'ESTORNADO' ? 'Este pedido foi estornado' : 'Este pedido expirou' }}
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ p.status === 'ESTORNADO' ? 'O valor foi devolvido e os downloads foram desativados.' : 'O prazo para pagar acabou. Suas fotos continuam no carrinho da galeria.' }}
      </p>
      <UiBotao class="mt-5" :to="voltaGaleria">Voltar pra galeria</UiBotao>
    </section>
  </div>
</template>
