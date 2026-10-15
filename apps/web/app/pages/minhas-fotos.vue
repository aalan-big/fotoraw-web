<script setup lang="ts">
// /minhas-fotos — tudo que o comprador já comprou, por evento, pra baixar quando quiser
// (enquanto a galeria existir). Entrar é sem senha: código por e-mail.
useSeoMeta({ title: 'Minhas fotos', description: 'Suas fotos compradas no FotoRAW.', robots: 'noindex' });

interface GrupoFotos {
  galeria: { id: string; titulo: string; slug: string; contaSlug: string; fotografo: string; capaUrl: string | null; dataEvento: string | null };
  pedidos: { id: string; numero: number; pagoEm: string | null }[];
  fotos: { fotoId: string; numero: string | null; miniaturaUrl: string | null; token: string }[];
}

const comprador = useComprador();
const { apiBase } = useRuntimeConfig().public;
const grupos = ref<GrupoFotos[]>([]);
const carregando = ref(false);
const erro = ref('');
const ios = ref(false);

async function carregarFotos() {
  if (!comprador.logado) return;
  carregando.value = true;
  erro.value = '';
  try {
    grupos.value = await comprador.chamar<GrupoFotos[]>('/compradores/eu/fotos');
  } catch {
    erro.value = comprador.logado ? 'Não foi possível carregar suas fotos. Tente de novo.' : '';
  } finally {
    carregando.value = false;
  }
}

onMounted(() => {
  comprador.carregar();
  ios.value = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  carregarFotos();
});

function sair() {
  comprador.sair();
  grupos.value = [];
}

// LGPD: apagar meus dados (nome, e-mail, WhatsApp, CPF)
const apagando = ref(false);
const confirmarApagar = ref(false);
async function apagarDados() {
  apagando.value = true;
  try {
    await comprador.chamar('/compradores/eu', { method: 'DELETE' });
    sair();
  } catch {
    erro.value = 'Não foi possível apagar agora. Tente de novo.';
  } finally {
    apagando.value = false;
    confirmarApagar.value = false;
  }
}

const link = (token: string) => `${apiBase}/publico/downloads/${token}/arquivo${ios.value ? '?modo=ver' : ''}`;
const total = computed(() => grupos.value.reduce((s, g) => s + g.fotos.length, 0));
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-12">
    <ClientOnly>
      <!-- não entrou -->
      <div v-if="!comprador.logado" class="mx-auto max-w-md">
        <h1 class="text-3xl font-bold tracking-tight">Minhas fotos</h1>
        <p class="mt-2 text-muted">Entre com o mesmo e-mail que você usou na compra. Sem senha.</p>
        <div class="card mt-8 p-6 md:p-8">
          <CompradorEntrar @entrou="carregarFotos" />
        </div>
      </div>

      <!-- entrou -->
      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold tracking-tight">Minhas fotos</h1>
            <p class="mt-1 text-sm text-muted">
              {{ comprador.perfil?.email }}
              <template v-if="total">
                · {{ total }} {{ total === 1 ? 'foto' : 'fotos' }} em {{ grupos.length }} {{ grupos.length === 1 ? 'evento' : 'eventos' }}
              </template>
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-11 items-center gap-2 rounded-lg border border-wine bg-wine-dim px-5 text-[15px] font-semibold text-text transition-colors hover:bg-wine hover:text-white"
            @click="sair"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7" />
            </svg>
            Sair da conta
          </button>
        </div>

        <p v-if="ios && total" class="mt-6 text-sm text-muted">
          No iPhone a foto abre na tela: toque e segure nela e escolha <strong class="text-text">Salvar na Fotos</strong>.
        </p>
        <p v-if="erro" class="mt-6 text-sm text-danger">{{ erro }}</p>

        <div v-if="carregando && !grupos.length" class="mt-10 text-center text-muted">Carregando…</div>

        <div v-else-if="!grupos.length" class="card mt-8 px-6 py-14 text-center">
          <p class="font-medium">Nenhuma foto comprada com este e-mail ainda</p>
          <p class="mt-1 text-sm text-muted">Achou suas fotos num evento? Compre por lá e elas aparecem aqui.</p>
          <UiBotao class="mt-5" to="/eventos">Ver eventos</UiBotao>
        </div>

        <section v-for="g in grupos" :key="g.galeria.id" class="mt-10">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 class="text-xl font-semibold uppercase tracking-tight">{{ g.galeria.titulo }}</h2>
              <p class="text-sm text-muted">
                {{ g.galeria.fotografo }}
                <template v-if="g.galeria.dataEvento"> · {{ formatarData(g.galeria.dataEvento, { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) }}</template>
              </p>
            </div>
            <NuxtLink :to="`/@${g.galeria.contaSlug}/${g.galeria.slug}`" class="text-sm text-wine-tint hover:underline">Ver a galeria</NuxtLink>
          </div>
          <ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <li v-for="f in g.fotos" :key="f.fotoId" class="card overflow-hidden">
              <img v-if="f.miniaturaUrl" :src="f.miniaturaUrl" alt="" class="aspect-4/3 w-full object-cover" loading="lazy" />
              <div class="flex items-center justify-between gap-2 p-2.5">
                <span class="truncate text-xs text-muted">{{ f.numero ? `nº ${f.numero}` : 'Foto' }}</span>
                <a
                  :href="link(f.token)"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex h-8 items-center rounded-md bg-wine px-3 text-xs font-semibold text-white hover:bg-wine-hover"
                >
                  {{ ios ? 'Abrir' : 'Baixar' }}
                </a>
              </div>
            </li>
          </ul>
        </section>

        <!-- LGPD -->
        <div class="mt-16 border-t border-border pt-6 text-sm text-muted">
          <p>
            Seus dados (nome, e-mail, WhatsApp e CPF) são usados só pros seus pedidos.
            <NuxtLink to="/privacidade" class="underline-offset-4 hover:text-text hover:underline">Privacidade</NuxtLink>
          </p>
          <button
            v-if="!confirmarApagar"
            type="button"
            class="mt-2 text-danger underline-offset-4 hover:underline"
            @click="confirmarApagar = true"
          >
            Apagar meus dados
          </button>
          <div v-else class="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-4">
            <p class="text-text">
              Apagar seus dados pessoais? Você perde o acesso a estas fotos por aqui (baixe antes o que quiser guardar).
              Os pedidos ficam registrados sem o seu nome, e-mail, WhatsApp ou CPF.
            </p>
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                :disabled="apagando"
                class="inline-flex h-10 items-center rounded-lg bg-danger px-4 font-semibold text-white disabled:opacity-50"
                @click="apagarDados"
              >
                {{ apagando ? 'Apagando…' : 'Sim, apagar' }}
              </button>
              <UiBotao variante="fantasma" @click="confirmarApagar = false">Cancelar</UiBotao>
            </div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
