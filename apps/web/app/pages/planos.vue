<script setup lang="ts">
import type { PlanoPublico } from '~/types/plano';

useSeoMeta({
  title: 'Planos para fotógrafos',
  description:
    'Venda fotos de evento de graça ou assine o plano Evento, PRO ou Business: mais espaço, taxa menor e a gestão do estúdio no desktop.',
});

const api = useApi();
const { fotografoUrl } = useRuntimeConfig().public;

// preço e limites vêm do banco (o admin edita) — nada de valor fixo aqui
const { data: planos, status } = await useAsyncData(
  'planos-publicos',
  () => api<PlanoPublico[]>('/publico/planos'),
  { default: () => [] },
);

const moeda = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const gb = (mb: number | null) =>
  mb === null ? 'Espaço sem limite' : `${mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`} na nuvem`;

function descricao(p: PlanoPublico): string {
  if (p.precoCentavos === 0) return 'Para começar a vender fotos de evento.';
  return p.permiteEnsaio
    ? 'Eventos, ensaios e a gestão do estúdio.'
    : 'Para quem vive de fotografar eventos.';
}

function itens(p: PlanoPublico): { texto: string; ok: boolean }[] {
  const lista = [
    { texto: gb(p.limiteArmazenamentoMb), ok: true },
    {
      texto:
        p.comissaoEventoPct > 0
          ? `Taxa de ${pct(p.comissaoEventoPct)}% por venda de evento`
          : 'Sem taxa do FotoRAW nas vendas',
      ok: true,
    },
  ];
  if (p.limiteGaleriasAtivas === null && p.limiteFotosPorGaleria === null) {
    lista.push({ texto: 'Galerias e fotos sem limite de quantidade', ok: true });
  } else {
    if (p.limiteGaleriasAtivas !== null)
      lista.push({ texto: `Até ${p.limiteGaleriasAtivas} galerias ativas`, ok: true });
    if (p.limiteFotosPorGaleria !== null)
      lista.push({
        texto: `Até ${p.limiteFotosPorGaleria.toLocaleString('pt-BR')} fotos por galeria`,
        ok: true,
      });
  }
  if (p.limiteDispositivos !== null) {
    lista.push({
      texto: `Até ${p.limiteDispositivos} ${p.limiteDispositivos === 1 ? 'computador' : 'computadores'}`,
      ok: true,
    });
  }
  lista.push({ texto: 'Ensaios, portfólio e seleção do cliente', ok: p.permiteEnsaio });
  lista.push({ texto: 'Gestão do estúdio no desktop', ok: p.permiteGestaoEstudio });
  return lista;
}

// destaque: o mais barato entre os que têm a gestão do estúdio (hoje, o PRO)
const destaque = computed(
  () =>
    planos.value
      .filter((p) => p.precoCentavos > 0 && p.permiteGestaoEstudio)
      .sort((a, b) => a.precoCentavos - b.precoCentavos)[0]?.codigo,
);
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-16 md:py-24">
    <div class="max-w-2xl">
      <p class="text-sm font-medium uppercase tracking-[0.2em] text-wine-tint">Para fotógrafos</p>
      <h1 class="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">Planos</h1>
      <p class="mt-4 text-lg leading-relaxed text-muted">
        Comece de graça vendendo fotos de evento. Quando precisar de mais espaço, de taxa menor ou
        dos ensaios e da gestão do estúdio, assine — mensal, no cartão, cancele quando quiser.
      </p>
    </div>

    <p v-if="status === 'error'" class="mt-12 text-muted">
      Não foi possível carregar os planos agora. Tente de novo em instantes.
    </p>

    <div v-else class="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="p in planos"
        :key="p.codigo"
        class="card relative flex flex-col justify-between p-7"
        :class="p.codigo === destaque ? 'border-wine/60' : ''"
      >
        <span
          v-if="p.codigo === destaque"
          class="absolute -top-3 right-5 rounded-full bg-wine px-3 py-0.5 text-[11px] font-semibold text-white"
        >
          Recomendado
        </span>

        <div>
          <h2 class="text-xl font-semibold">{{ p.nome }}</h2>
          <p class="mt-1 text-sm text-muted">{{ descricao(p) }}</p>

          <div class="mt-5 flex items-baseline gap-1">
            <template v-if="p.precoCentavos > 0">
              <span class="text-3xl font-bold tracking-tight">{{ moeda(p.precoCentavos) }}</span>
              <span class="text-sm text-muted">/mês</span>
            </template>
            <span v-else class="text-3xl font-bold tracking-tight">Grátis</span>
          </div>

          <ul class="mt-6 space-y-2.5 text-sm">
            <li v-for="item in itens(p)" :key="item.texto" class="flex items-start gap-2.5">
              <svg
                v-if="item.ok"
                viewBox="0 0 24 24"
                class="mt-0.5 size-4 shrink-0 text-success"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                class="mt-0.5 size-4 shrink-0 text-muted/60"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
              <span :class="item.ok ? 'text-text' : 'text-muted/70'">{{ item.texto }}</span>
            </li>
          </ul>
        </div>

        <UiBotao
          :to="`${fotografoUrl}/criar-conta`"
          :variante="p.codigo === destaque ? 'primaria' : 'secundaria'"
          class="mt-8 w-full"
        >
          {{ p.precoCentavos > 0 ? `Começar com o ${p.nome}` : 'Começar de graça' }}
        </UiBotao>
      </div>
    </div>

    <div class="mt-12 grid gap-4 text-sm text-muted md:grid-cols-3">
      <p>
        <strong class="text-text">14 dias de PRO grátis.</strong> Todo cadastro começa com o PRO
        liberado, sem cartão. Depois você escolhe o plano — ou segue no gratuito.
      </p>
      <p>
        <strong class="text-text">O dinheiro das vendas é seu.</strong> O pagamento do cliente cai
        direto na sua conta do Mercado Pago; a taxa do FotoRAW (quando houver) sai na hora.
      </p>
      <p>
        <strong class="text-text">Taxas do Mercado Pago à parte.</strong> Pix e cartão têm a tarifa
        do próprio Mercado Pago, cobrada por ele sobre cada venda.
      </p>
    </div>
  </div>
</template>
