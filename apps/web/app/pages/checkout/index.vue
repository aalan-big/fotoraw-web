<script setup lang="ts">
// /checkout?galeria=<id>&volta=/@conta/galeria — o carrinho daquela galeria vira pedido.
// Sem conta: nome, e-mail (onde chegam as fotos), WhatsApp e CPF (o Pix exige).
// Preço e comissão quem calcula é o server; aqui é só o resumo.
definePageMeta({ layout: 'default' });
useSeoMeta({ title: 'Finalizar compra', robots: 'noindex' });

const rota = useRoute();
const api = useApi();
const carrinho = useCarrinho();
const comprador = useComprador();
const mostrarEntrar = ref(false);

const galeriaId = computed(() => String(rota.query.galeria ?? ''));
const volta = computed(() => (typeof rota.query.volta === 'string' && rota.query.volta.startsWith('/') ? rota.query.volta : '/eventos'));
const codigo = computed(() => (rota.query.codigo ? String(rota.query.codigo) : undefined));

const montado = ref(false);
onMounted(() => {
  carrinho.carregar();
  comprador.carregar();
  preencher();
  montado.value = true;
});

// entrou (antes ou agora): nome, e-mail, WhatsApp e CPF vêm da conta
function preencher() {
  const p = comprador.perfil;
  if (!p) return;
  mostrarEntrar.value = false;
  form.email = p.email;
  if (p.nome && p.nome.includes(' ')) form.nome = p.nome;
  if (p.whatsapp) form.whatsapp = mascaraFone(p.whatsapp);
  if (p.cpf) form.cpf = mascaraCpf(p.cpf);
}
const itens = computed(() => (galeriaId.value ? carrinho.itens(galeriaId.value) : []));
const total = computed(() => (galeriaId.value ? carrinho.totalCentavos(galeriaId.value) : 0));

const form = reactive({ nome: '', email: '', whatsapp: '', cpf: '', termos: false });
const erros = ref<Record<string, string>>({});
const erroGeral = ref('');
const enviando = ref(false);

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}
function mascaraFone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function validar() {
  const e: Record<string, string> = {};
  if (form.nome.trim().split(/\s+/).length < 2) e.nome = 'Nome e sobrenome';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'E-mail inválido — é nele que chegam as fotos';
  if (form.cpf.replace(/\D/g, '').length !== 11) e.cpf = 'CPF com 11 dígitos';
  if (!form.termos) e.termos = 'É preciso aceitar os termos';
  erros.value = e;
  return Object.keys(e).length === 0;
}

async function finalizar() {
  erroGeral.value = '';
  if (!validar()) return;
  enviando.value = true;
  try {
    const pedido = await api<{ id: string; numero: number }>('/publico/pedidos', {
      method: 'POST',
      body: {
        galeriaId: galeriaId.value,
        fotoIds: itens.value.map((i) => i.fotoId),
        codigo: codigo.value,
        comprador: { nome: form.nome, email: form.email, whatsapp: form.whatsapp, cpf: form.cpf },
        aceitouTermos: true,
      },
    });
    // guarda pra próxima compra (só quem entrou)
    if (comprador.logado) {
      await comprador
        .atualizarPerfil({ nome: form.nome.trim(), whatsapp: form.whatsapp, cpf: form.cpf })
        .catch(() => {});
    }
    await navigateTo(`/pedido/${pedido.id}`);
  } catch (e) {
    const dados = (e as { data?: { mensagem?: string; erros?: { campo: string; mensagem: string }[] } }).data;
    const porCampo = Object.fromEntries((dados?.erros ?? []).map((x) => [x.campo.replace('comprador.', ''), x.mensagem]));
    if (Object.keys(porCampo).length) erros.value = porCampo;
    erroGeral.value = dados?.mensagem && dados.mensagem !== 'Dados inválidos' ? dados.mensagem : Object.keys(porCampo).length ? '' : 'Não foi possível criar o pedido. Tente de novo.';
  } finally {
    enviando.value = false;
  }
}

const campo =
  'h-12 w-full rounded-lg border border-border bg-bg px-4 outline-none placeholder:text-muted/50 focus:border-wine focus:ring-2 focus:ring-wine-dim';
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-12">
    <NuxtLink :to="volta" class="text-sm text-muted hover:text-text">← Voltar pra galeria</NuxtLink>
    <h1 class="mt-3 text-3xl font-bold tracking-tight">Finalizar compra</h1>

    <div v-if="montado && !itens.length" class="card mt-8 p-10 text-center">
      <p class="font-medium">Seu carrinho está vazio</p>
      <p class="mt-1 text-sm text-muted">Volte à galeria e escolha as fotos.</p>
      <UiBotao class="mt-5" :to="volta">Voltar pra galeria</UiBotao>
    </div>

    <div v-else-if="montado" class="mt-8 grid gap-8 md:grid-cols-[1fr_340px]">
      <form class="card space-y-5 p-6 md:p-8" novalidate @submit.prevent="finalizar">
        <div>
          <h2 class="text-lg font-semibold">Seus dados</h2>
          <p class="mt-1 text-sm text-muted">As fotos chegam no seu e-mail assim que o pagamento for confirmado.</p>
        </div>

        <!-- entrar é opcional: só preenche os dados e guarda as compras em "Minhas fotos" -->
        <div v-if="!comprador.logado" class="rounded-lg border border-border bg-bg/60 p-4">
          <button
            v-if="!mostrarEntrar"
            type="button"
            class="flex w-full items-center justify-between gap-3 text-left text-sm"
            @click="mostrarEntrar = true"
          >
            <span><strong>Já comprou com a gente?</strong> <span class="text-muted">Entre pra preencher tudo sozinho.</span></span>
            <span class="shrink-0 font-semibold text-wine-tint">Entrar</span>
          </button>
          <CompradorEntrar v-else compacto @entrou="preencher" />
        </div>
        <p v-else class="text-sm text-muted">
          Comprando como <strong class="text-text">{{ comprador.perfil?.email }}</strong>.
          <button type="button" class="underline-offset-4 hover:text-text hover:underline" @click="comprador.sair(); form.email = ''">Não é você?</button>
        </p>

        <label class="block">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Nome completo</span>
          <input v-model="form.nome" :class="campo" autocomplete="name" placeholder="Maria da Silva" />
          <span v-if="erros.nome" class="mt-1 block text-xs text-danger">{{ erros.nome }}</span>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">E-mail</span>
          <input
            v-model="form.email"
            :class="[campo, comprador.logado ? 'opacity-70' : '']"
            type="email"
            autocomplete="email"
            placeholder="voce@email.com"
            :readonly="comprador.logado"
          />
          <span v-if="erros.email" class="mt-1 block text-xs text-danger">{{ erros.email }}</span>
        </label>
        <div class="grid gap-5 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">WhatsApp <span class="font-normal normal-case text-muted/70">(opcional)</span></span>
            <input
              :value="form.whatsapp"
              :class="campo"
              inputmode="tel"
              autocomplete="tel"
              placeholder="(41) 99999-0000"
              @input="form.whatsapp = mascaraFone(($event.target as HTMLInputElement).value)"
            />
            <span v-if="erros.whatsapp" class="mt-1 block text-xs text-danger">{{ erros.whatsapp }}</span>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">CPF</span>
            <input
              :value="form.cpf"
              :class="campo"
              inputmode="numeric"
              placeholder="000.000.000-00"
              @input="form.cpf = mascaraCpf(($event.target as HTMLInputElement).value)"
            />
            <span v-if="erros.cpf" class="mt-1 block text-xs text-danger">{{ erros.cpf }}</span>
          </label>
        </div>

        <label class="flex items-start gap-3 text-sm text-muted">
          <input v-model="form.termos" type="checkbox" class="mt-0.5 size-4 accent-wine" />
          <span>
            Li e aceito os <NuxtLink to="/termos" target="_blank" class="text-text underline underline-offset-4">termos de compra</NuxtLink>.
            Meus dados são usados só pra este pedido e pra entrega das fotos.
          </span>
        </label>
        <span v-if="erros.termos" class="block text-xs text-danger">{{ erros.termos }}</span>

        <p v-if="erroGeral" class="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{{ erroGeral }}</p>

        <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">
          {{ enviando ? 'Criando pedido…' : 'Ir para o pagamento' }}
        </UiBotao>
        <p class="text-center text-xs text-muted/80">Pix ou cartão de crédito, pelo Mercado Pago.</p>
      </form>

      <aside class="card h-fit p-6">
        <h2 class="font-semibold">Resumo</h2>
        <ul class="mt-4 grid grid-cols-4 gap-2">
          <li v-for="item in itens" :key="item.fotoId" class="relative aspect-square overflow-hidden rounded-md bg-surface-2">
            <img v-if="item.url" :src="item.url" alt="" class="size-full object-cover" />
          </li>
        </ul>
        <dl class="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">{{ itens.length }} {{ itens.length === 1 ? 'foto' : 'fotos' }}</dt>
            <dd class="tabular-nums">{{ formatarCentavos(total) }}</dd>
          </div>
          <div class="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd class="tabular-nums text-wine-tint">{{ formatarCentavos(total) }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-xs text-muted">Fotos em alta resolução, sem marca d'água. Link de download por 30 dias.</p>
      </aside>
    </div>
  </div>
</template>
