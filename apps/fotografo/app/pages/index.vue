<script setup lang="ts">
definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Início' });

const sessao = useSessao();
const api = useApi();
const eu = computed(() => sessao.eu);

const reenviando = ref(false);
const reenviado = ref(false);
async function reenviarVerificacao() {
  if (!sessao.conta) return;
  reenviando.value = true;
  try {
    await api('/auth/reenviar-verificacao', {
      method: 'POST',
      body: { email: sessao.conta.email },
    });
    reenviado.value = true;
  } finally {
    reenviando.value = false;
  }
}

const rotuloPlano = computed(() => {
  const l = eu.value?.licenca;
  if (!l) return '';
  return { gratuito: 'Gratuito', trial: 'PRO (trial)', pro: 'PRO' }[l.plano];
});

const fmt = (n: number | null, unidade = '') => (n === null ? 'sem limite' : `${n}${unidade}`);
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Olá, {{ sessao.conta?.nome }}</h1>
      <p class="text-sm text-muted">O que aconteceu na sua vitrine e o que falta fazer.</p>
    </div>

    <!-- pendências -->
    <div v-if="eu?.pendencias.length" class="space-y-2">
      <UiAlerta v-if="eu.pendencias.includes('verificar_email')" tipo="aviso">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>
            Confirme seu e-mail (<strong>{{ sessao.conta?.email }}</strong
            >) pra publicar galerias.
          </span>
          <button
            type="button"
            class="font-medium underline-offset-2 hover:underline disabled:opacity-60"
            :disabled="reenviando || reenviado"
            @click="reenviarVerificacao"
          >
            {{ reenviado ? 'Enviado!' : 'Reenviar e-mail' }}
          </button>
        </div>
      </UiAlerta>
      <UiAlerta v-if="eu.pendencias.includes('completar_perfil')" tipo="info">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>Complete o perfil público: cidade e WhatsApp ajudam o cliente a te achar.</span>
          <NuxtLink to="/perfil" class="font-medium hover:underline">Completar</NuxtLink>
        </div>
      </UiAlerta>
      <UiAlerta v-if="eu.pendencias.includes('licenca_vencendo')" tipo="aviso">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>
            Sua licença vence em {{ eu.licenca.diasRestantes }}
            {{ eu.licenca.diasRestantes === 1 ? 'dia' : 'dias' }}.
          </span>
          <NuxtLink to="/plano" class="font-medium hover:underline">Ver plano</NuxtLink>
        </div>
      </UiAlerta>
    </div>

    <!-- resumo (vendas/galerias chegam com os módulos de vitrine) -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="card p-5">
        <p class="rotulo">Vendas no mês</p>
        <p class="text-2xl font-semibold">R$ 0,00</p>
        <p class="text-xs text-muted">nenhuma venda ainda</p>
      </div>
      <div class="card p-5">
        <p class="rotulo">A receber</p>
        <p class="text-2xl font-semibold">R$ 0,00</p>
        <p class="text-xs text-muted">repasse via Mercado Pago</p>
      </div>
      <div class="card p-5">
        <p class="rotulo">Galerias no ar</p>
        <p class="text-2xl font-semibold">0</p>
        <p class="text-xs text-muted">publique pelo desktop</p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <UiCartao titulo="Seu plano" :descricao="rotuloPlano">
        <template #acoes>
          <UiBotao to="/plano" variante="secundaria">Ver plano</UiBotao>
        </template>
        <dl v-if="eu" class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">Galerias ativas</dt>
          <dd>{{ fmt(eu.licenca.recursos.limite_galerias_ativas) }}</dd>
          <dt class="text-muted">Fotos por galeria</dt>
          <dd>{{ fmt(eu.licenca.recursos.limite_fotos_por_galeria) }}</dd>
          <dt class="text-muted">Armazenamento</dt>
          <dd>{{ fmt(eu.licenca.recursos.limite_armazenamento_mb, ' MB') }}</dd>
          <dt class="text-muted">Máquinas</dt>
          <dd>{{ fmt(eu.licenca.recursos.limite_dispositivos) }}</dd>
          <dt class="text-muted">Galeria privada</dt>
          <dd>{{ eu.licenca.recursos.permite_galeria_privada ? 'sim' : 'só no PRO' }}</dd>
          <template v-if="eu.licenca.validaAte">
            <dt class="text-muted">Válida até</dt>
            <dd>{{ new Date(eu.licenca.validaAte).toLocaleDateString('pt-BR') }}</dd>
          </template>
        </dl>
      </UiCartao>

      <UiCartao
        titulo="Conectar o desktop"
        descricao="No FotoRAW desktop, entre com o mesmo e-mail e senha desta conta."
      >
        <template #acoes>
          <UiBotao to="/dispositivos" variante="secundaria">Dispositivos</UiBotao>
        </template>
        <ol class="list-inside list-decimal space-y-1 text-sm text-muted">
          <li>Abra o FotoRAW no computador do estúdio.</li>
          <li>
            Na tela de login, use <strong class="text-text">{{ sessao.conta?.email }}</strong
            >.
          </li>
          <li>Pronto: publicar galerias e receber pedidos passa a funcionar.</li>
        </ol>
      </UiCartao>
    </div>
  </div>
</template>
