<script setup lang="ts">
import type { FotoPublica } from '~/types/galeria';

// Foto ampliada: setas/teclado passam, Esc fecha. O botão de compra só
// aparece quando a galeria vende.
const props = defineProps<{
  fotos: FotoPublica[];
  podeComprar: boolean;
  /** modo pacote: "escolher" em vez de "comprar" */
  pacote?: boolean;
  escolhida: (foto: FotoPublica) => boolean;
  /** pacote: já está numa seleção confirmada */
  jaEscolhida?: (foto: FotoPublica) => boolean;
  /** entrega: link direto do original */
  linkBaixar?: (foto: FotoPublica) => string;
}>();
const indice = defineModel<number | null>({ required: true });
const emit = defineEmits<{ alternar: [foto: FotoPublica] }>();

const foto = computed(() => (indice.value == null ? null : props.fotos[indice.value] ?? null));

function ir(passo: number) {
  if (indice.value == null) return;
  const proximo = indice.value + passo;
  if (proximo >= 0 && proximo < props.fotos.length) indice.value = proximo;
}

function aoTeclar(e: KeyboardEvent) {
  if (indice.value == null) return;
  if (e.key === 'Escape') indice.value = null;
  else if (e.key === 'ArrowRight') ir(1);
  else if (e.key === 'ArrowLeft') ir(-1);
}
onMounted(() => document.addEventListener('keydown', aoTeclar));
onUnmounted(() => document.removeEventListener('keydown', aoTeclar));

// trava a rolagem da página por trás
watch(indice, (v) => {
  document.body.style.overflow = v == null ? '' : 'hidden';
});
onUnmounted(() => (document.body.style.overflow = ''));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="foto"
      class="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="indice = null"
    >
      <header class="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
        <span class="text-sm tabular-nums text-muted">
          {{ (indice ?? 0) + 1 }} de {{ fotos.length }}
          <template v-if="foto.numero"> · nº {{ foto.numero }}</template>
        </span>
        <button
          type="button"
          class="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
          aria-label="Fechar"
          @click="indice = null"
        >
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div class="relative flex min-h-0 flex-1 items-center justify-center px-2 md:px-16" @click.self="indice = null">
        <div class="relative flex max-h-full max-w-full" @contextmenu.prevent>
          <img
            :key="foto.id"
            :src="foto.url ?? ''"
            :alt="foto.numero ? `Foto nº ${foto.numero}` : 'Foto'"
            class="pointer-events-none max-h-[calc(100dvh-10rem)] max-w-full select-none rounded-md object-contain"
            draggable="false"
          />
          <!-- camada transparente: "salvar imagem" pega o vazio, não a foto -->
          <span class="absolute inset-0" aria-hidden="true" />
        </div>
        <button
          v-if="(indice ?? 0) > 0"
          type="button"
          class="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-text backdrop-blur transition-colors hover:bg-wine md:left-4"
          aria-label="Foto anterior"
          @click="ir(-1)"
        >
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          v-if="(indice ?? 0) < fotos.length - 1"
          type="button"
          class="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-text backdrop-blur transition-colors hover:bg-wine md:right-4"
          aria-label="Próxima foto"
          @click="ir(1)"
        >
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <!-- só na prévia com marca; na entrega a foto já é do cliente -->
      <p v-if="!linkBaixar" class="px-4 pt-3 text-center text-[11px] leading-snug text-muted">
        Foto protegida por direito autoral (Lei 9.610/98). Remover a marca d'água ou usar sem comprar é crime.
      </p>
      <footer v-if="linkBaixar" class="flex items-center justify-center px-4 py-4">
        <a
          :href="linkBaixar(foto)"
          target="_blank"
          rel="noopener"
          class="inline-flex h-12 items-center rounded-lg bg-wine px-6 font-medium text-white hover:bg-wine-hover"
        >
          Baixar em alta resolução
        </a>
      </footer>
      <footer v-else-if="jaEscolhida?.(foto)" class="flex items-center justify-center px-4 py-4 text-sm text-muted">
        Esta foto já está na sua seleção.
      </footer>
      <footer v-else-if="podeComprar" class="flex items-center justify-center gap-4 px-4 py-4">
        <span v-if="!pacote && foto.precoCentavos != null" class="text-lg font-semibold tabular-nums">
          {{ formatarCentavos(foto.precoCentavos) }}
        </span>
        <UiBotao :variante="escolhida(foto) ? 'secundaria' : 'primaria'" tamanho="lg" @click="emit('alternar', foto)">
          <template v-if="pacote">{{ escolhida(foto) ? 'Desmarcar' : 'Escolher esta foto' }}</template>
          <template v-else>{{ escolhida(foto) ? 'Tirar do carrinho' : 'Adicionar ao carrinho' }}</template>
        </UiBotao>
      </footer>
    </div>
  </Teleport>
</template>
