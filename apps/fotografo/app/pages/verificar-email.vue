<script setup lang="ts">
/** Destino do link "Confirmar e-mail". Também serve a troca de e-mail (`?troca=1`). */
definePageMeta({ layout: 'vazio' });
useSeoMeta({ title: 'Confirmar e-mail' });

const api = useApi();
const sessao = useSessao();
const rota = useRoute();
const troca = computed(() => rota.query.troca === '1');
const estado = ref<'confirmando' | 'ok' | 'erro'>('confirmando');
const mensagem = ref('');

onMounted(async () => {
  const token = typeof rota.query.token === 'string' ? rota.query.token : '';
  if (!token) {
    estado.value = 'erro';
    mensagem.value = 'Link inválido.';
    return;
  }
  try {
    await api(troca.value ? '/auth/confirmar-email' : '/auth/verificar-email', {
      method: 'POST',
      body: { token },
    });
    estado.value = 'ok';
    if (sessao.logado) await sessao.carregarEu().catch(() => null);
  } catch (e) {
    estado.value = 'erro';
    mensagem.value = lerErroApi(e).mensagem;
  }
});
</script>

<template>
  <div class="card mt-6 space-y-4 p-6 text-center">
    <template v-if="estado === 'confirmando'">
      <p class="text-muted">Confirmando seu e-mail…</p>
    </template>
    <template v-else-if="estado === 'ok'">
      <h1 class="text-lg font-semibold">
        {{ troca ? 'Novo e-mail confirmado' : 'E-mail confirmado' }}
      </h1>
      <p class="text-sm text-muted">
        {{
          troca
            ? 'Seu login agora é com o e-mail novo.'
            : 'Agora você pode publicar galerias e receber vendas.'
        }}
      </p>
      <UiBotao :to="sessao.logado ? '/' : '/entrar'" class="w-full">
        {{ sessao.logado ? 'Ir pro painel' : 'Entrar' }}
      </UiBotao>
    </template>
    <template v-else>
      <h1 class="text-lg font-semibold">Não deu</h1>
      <UiAlerta tipo="erro">{{ mensagem }}</UiAlerta>
      <p class="text-sm text-muted">Peça um link novo em Conta → "Reenviar confirmação".</p>
      <UiBotao :to="sessao.logado ? '/conta' : '/entrar'" variante="secundaria" class="w-full">
        {{ sessao.logado ? 'Ir pra Conta' : 'Entrar' }}
      </UiBotao>
    </template>
  </div>
</template>
