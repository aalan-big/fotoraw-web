<script setup lang="ts">
definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Conectando Mercado Pago' });

const route = useRoute();
const router = useRouter();
const api = useApi();

const carregando = ref(true);
const erro = ref<string | null>(null);
const sucesso = ref(false);

onMounted(async () => {
  const code = route.query.code as string | undefined;
  const state = route.query.state as string | undefined;

  if (!code || !state) {
    carregando.value = false;
    erro.value = 'Parâmetros de autenticação inválidos ou expirados (código ou estado ausente).';
    return;
  }

  try {
    await api('/financeiro/mercado-pago/callback', {
      method: 'POST',
      body: { code, state },
    });

    sucesso.value = true;
    carregando.value = false;

    // Redireciona de volta para a aba financeira após breve confirmação visual
    setTimeout(() => {
      router.push('/financeiro?sucesso=mp_conectado');
    }, 1500);
  } catch (err: unknown) {
    carregando.value = false;
    const fetchErr = err as { data?: { message?: string } };
    erro.value =
      fetchErr?.data?.message ??
      'Não foi possível concluir a integração com o Mercado Pago. Tente novamente.';
  }
});
</script>

<template>
  <div class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
    <div v-if="carregando" class="card flex flex-col items-center p-8">
      <div
        class="size-12 animate-spin rounded-full border-4 border-surface-2 border-t-wine mb-4"
        aria-label="Carregando"
      />
      <h1 class="text-lg font-semibold text-text">Conectando ao Mercado Pago</h1>
      <p class="mt-2 text-sm text-muted">
        Estamos validando suas credenciais com segurança e ativando o recebimento em sua conta...
      </p>
    </div>

    <div v-else-if="sucesso" class="card flex flex-col items-center p-8 border-success/30">
      <div class="mb-4 flex size-12 items-center justify-center rounded-full bg-success/20 text-success">
        <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 class="text-lg font-semibold text-text">Conta conectada com sucesso!</h1>
      <p class="mt-2 text-sm text-muted">
        Suas vendas agora serão processadas diretamente em sua conta Mercado Pago. Redirecionando...
      </p>
    </div>

    <div v-else class="card flex flex-col items-center p-8 border-danger/30">
      <div class="mb-4 flex size-12 items-center justify-center rounded-full bg-danger/20 text-danger">
        <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <h1 class="text-lg font-semibold text-text">Falha na conexão</h1>
      <p class="mt-2 text-sm text-danger">
        {{ erro }}
      </p>
      <div class="mt-6">
        <UiBotao to="/financeiro" variante="secundaria">
          Voltar para o Financeiro
        </UiBotao>
      </div>
    </div>
  </div>
</template>
