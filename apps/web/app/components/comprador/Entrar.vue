<script setup lang="ts">
import type { PerfilComprador } from '~/stores/comprador';

// Entrar sem senha: código de 6 dígitos no e-mail (entra sozinho ao digitar ou colar).
const props = withDefaults(defineProps<{ compacto?: boolean; emailInicial?: string }>(), { compacto: false, emailInicial: '' });
const emit = defineEmits<{ entrou: [] }>();

const api = useApi();
const comprador = useComprador();

const passo = ref<'email' | 'codigo'>('email');
const email = ref(props.emailInicial);
const codigo = ref('');
const erro = ref('');
const enviando = ref(false);

function concluir(r: { acesso: string; comprador: PerfilComprador }) {
  comprador.entrou(r);
  emit('entrou');
}

function mensagem(e: unknown, padrao: string) {
  return (e as { data?: { mensagem?: string } }).data?.mensagem ?? padrao;
}

async function pedirCodigo() {
  erro.value = '';
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) {
    erro.value = 'Digite um e-mail válido';
    return;
  }
  enviando.value = true;
  try {
    await api('/compradores/entrar/codigo', { method: 'POST', body: { email: email.value } });
    passo.value = 'codigo';
    codigo.value = '';
  } catch (e) {
    erro.value = mensagem(e, 'Não foi possível enviar o código. Tente de novo.');
  } finally {
    enviando.value = false;
  }
}

async function confirmar() {
  erro.value = '';
  enviando.value = true;
  try {
    concluir(await api('/compradores/entrar/confirmar', { method: 'POST', body: { email: email.value, codigo: codigo.value } }));
  } catch (e) {
    erro.value = mensagem(e, 'Código incorreto. Confira o e-mail.');
  } finally {
    enviando.value = false;
  }
}
// 6 dígitos digitados (ou colados do e-mail): entra sozinho
watch(codigo, (v) => {
  if (v.replace(/\D/g, '').length === 6 && !enviando.value) confirmar();
});

const campo =
  'h-12 w-full rounded-lg border border-border bg-bg px-4 outline-none placeholder:text-muted/50 focus:border-wine focus:ring-2 focus:ring-wine-dim';
</script>

<template>
  <div class="space-y-4">
    <template v-if="passo === 'email'">
      <form class="flex flex-col gap-3" :class="compacto ? 'sm:flex-row' : ''" @submit.prevent="pedirCodigo">
        <input v-model="email" type="email" autocomplete="email" placeholder="seu@email.com" aria-label="E-mail" :class="campo" />
        <UiBotao type="submit" class="h-12 shrink-0" :disabled="enviando">
          {{ enviando ? 'Enviando…' : 'Receber código' }}
        </UiBotao>
      </form>
    </template>

    <form v-else class="space-y-3" @submit.prevent="confirmar">
      <p class="text-sm text-muted">
        Mandamos um código de 6 dígitos para <strong class="text-text">{{ email }}</strong>. Confira também o spam.
      </p>
      <input
        v-model="codigo"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="7"
        placeholder="000000"
        aria-label="Código de 6 dígitos"
        class="h-14 w-full rounded-lg border border-border bg-bg px-4 text-center text-2xl font-bold tracking-[0.4em] outline-none placeholder:text-muted/40 focus:border-wine focus:ring-2 focus:ring-wine-dim"
      />
      <UiBotao type="submit" tamanho="lg" class="w-full" :disabled="enviando">{{ enviando ? 'Entrando…' : 'Entrar' }}</UiBotao>
      <button type="button" class="w-full text-sm text-muted underline-offset-4 hover:text-text hover:underline" @click="passo = 'email'">
        Usar outro e-mail
      </button>
    </form>

    <p v-if="erro" class="text-sm text-danger">{{ erro }}</p>
  </div>
</template>
