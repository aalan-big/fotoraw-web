<script setup lang="ts">
import QRCode from 'qrcode';

const props = defineProps<{
  aberto: boolean;
  titulo: string;
  link: string;
  codigoAcesso?: string | null;
}>();

const emit = defineEmits<{
  (e: 'fechar'): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const copiadoLink = ref(false);
const copiadoCodigo = ref(false);

watch(
  () => [props.aberto, props.link],
  async ([aberto]) => {
    if (!aberto) return;
    await nextTick();
    if (canvasRef.value && props.link) {
      QRCode.toCanvas(canvasRef.value, props.link, {
        width: 256,
        margin: 2,
        color: {
          dark: '#0a0a0a',
          light: '#ffffff',
        },
      });
    }
  },
  { immediate: true },
);

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(props.link);
    copiadoLink.value = true;
    setTimeout(() => (copiadoLink.value = false), 2000);
  } catch {
    /* fallback */
  }
}

async function copiarCodigo() {
  if (!props.codigoAcesso) return;
  try {
    await navigator.clipboard.writeText(props.codigoAcesso);
    copiadoCodigo.value = true;
    setTimeout(() => (copiadoCodigo.value = false), 2000);
  } catch {
    /* fallback */
  }
}

function baixarQrCode() {
  if (!canvasRef.value) return;
  const url = canvasRef.value.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `qrcode-${props.titulo.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
  a.click();
}
</script>

<template>
  <div
    v-if="aberto"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    @click.self="emit('fechar')"
  >
    <div
      class="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl transition-all"
    >
      <!-- botão fechar -->
      <button
        type="button"
        class="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
        @click="emit('fechar')"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div>
        <h3 class="text-lg font-semibold tracking-tight">{{ titulo }}</h3>
        <p class="mt-1 text-xs text-muted">
          Compartilhe este QR Code ou link para seus clientes acessarem a galeria.
        </p>
      </div>

      <!-- canvas do QR Code -->
      <div class="mt-5 flex flex-col items-center justify-center">
        <div class="rounded-xl border border-border bg-white p-3 shadow-inner">
          <canvas ref="canvasRef" class="size-52 rounded-lg" />
        </div>
        <UiBotao
          variante="secundaria"
          class="mt-3 text-xs"
          @click="baixarQrCode"
        >
          <svg
            viewBox="0 0 24 24"
            class="mr-1.5 size-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Baixar imagem (PNG para impressão)
        </UiBotao>
      </div>

      <!-- código de acesso destacado (se galeria privada) -->
      <div
        v-if="codigoAcesso"
        class="mt-5 rounded-lg border border-wine/30 bg-wine-dim/50 p-3 text-center"
      >
        <p class="text-xs font-medium uppercase tracking-wider text-wine-tint">
          Código de acesso (galeria privada)
        </p>
        <div class="mt-1 flex items-center justify-center gap-2">
          <span class="font-mono text-xl font-bold tracking-widest text-text">
            {{ codigoAcesso }}
          </span>
          <button
            type="button"
            class="rounded px-2 py-0.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text"
            @click="copiarCodigo"
          >
            {{ copiadoCodigo ? 'Copiado ✓' : 'Copiar' }}
          </button>
        </div>
      </div>

      <!-- link público da vitrine -->
      <div class="mt-4">
        <label class="text-xs text-muted">Link público da vitrine</label>
        <div class="mt-1 flex items-center gap-2 rounded-lg border border-border bg-bg p-1.5 pl-3">
          <span class="truncate text-xs font-medium text-wine-tint">{{ link }}</span>
          <button
            type="button"
            class="ml-auto shrink-0 rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-surface"
            @click="copiarLink"
          >
            {{ copiadoLink ? 'Copiado ✓' : 'Copiar' }}
          </button>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <UiBotao variante="secundaria" @click="emit('fechar')">
          Fechar
        </UiBotao>
      </div>
    </div>
  </div>
</template>
