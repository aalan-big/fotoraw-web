<script setup lang="ts">
import type { VisaoGeral } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useSeoMeta({ title: 'Visão geral' });

const api = useApi();
const { data: v, status } = await useAsyncData('visao-geral', () =>
  api<VisaoGeral>('/admin/visao-geral'),
);
const licencasAtivas = computed(() => {
  const l = v.value?.licencas;
  return l ? l.trial + l.assinatura + l.cortesia + l.vitalicia : 0;
});
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Visão geral</h1>
      <p class="text-sm text-muted">Como a plataforma está agora.</p>
    </div>

    <p v-if="status === 'pending'" class="text-sm text-muted">Carregando…</p>

    <template v-else-if="v">
      <!-- alertas -->
      <div
        v-if="v.licencas.trialsVencendoEm7Dias || v.webhooksComErro || v.contas.semVerificarEmail"
        class="grid gap-3 sm:grid-cols-3"
      >
        <UiStat
          v-if="v.licencas.trialsVencendoEm7Dias"
          rotulo="Trials vencendo em 7 dias"
          :valor="v.licencas.trialsVencendoEm7Dias"
          to="/licencas?tipo=TRIAL&venceEmDias=7"
          alerta
        />
        <UiStat
          v-if="v.contas.semVerificarEmail"
          rotulo="Contas sem confirmar e-mail"
          :valor="v.contas.semVerificarEmail"
          to="/fotografos"
        />
        <UiStat
          v-if="v.webhooksComErro"
          rotulo="Webhooks com erro"
          :valor="v.webhooksComErro"
          to="/sistema"
          alerta
        />
      </div>

      <!-- contas -->
      <section>
        <h2 class="rotulo">Fotógrafos</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UiStat rotulo="Contas ativas" :valor="v.contas.ativas" to="/fotografos?status=ATIVA" />
          <UiStat rotulo="Novas em 30 dias" :valor="v.contas.novasNos30Dias" />
          <UiStat
            rotulo="Suspensas"
            :valor="v.contas.suspensas"
            to="/fotografos?status=SUSPENSA"
            :alerta="v.contas.suspensas > 0"
          />
          <UiStat
            rotulo="Bloqueadas"
            :valor="v.contas.bloqueadas"
            to="/fotografos?status=BLOQUEADA"
          />
        </div>
      </section>

      <!-- licenças -->
      <section>
        <h2 class="rotulo">Licenças ativas ({{ licencasAtivas }})</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UiStat rotulo="Trial" :valor="v.licencas.trial" to="/licencas?tipo=TRIAL&status=ATIVA" />
          <UiStat
            rotulo="Assinatura"
            :valor="v.licencas.assinatura"
            to="/licencas?tipo=ASSINATURA&status=ATIVA"
          />
          <UiStat
            rotulo="Cortesia"
            :valor="v.licencas.cortesia"
            to="/licencas?tipo=CORTESIA&status=ATIVA"
          />
          <UiStat
            rotulo="Vitalícia"
            :valor="v.licencas.vitalicia"
            to="/licencas?tipo=VITALICIA&status=ATIVA"
          />
        </div>
      </section>

      <!-- dinheiro e uso -->
      <section>
        <h2 class="rotulo">Este mês</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UiStat
            rotulo="Vendas"
            :valor="dinheiro(v.vendasMes.totalCentavos)"
            :detalhe="`${v.vendasMes.pedidos} pedidos pagos`"
          />
          <UiStat rotulo="Comissão da plataforma" :valor="dinheiro(v.vendasMes.comissaoCentavos)" />
          <UiStat
            rotulo="Repasses a pagar"
            :valor="dinheiro(v.repassesAbertos.valorCentavos)"
            :detalhe="`${v.repassesAbertos.quantidade} em aberto`"
            :alerta="v.repassesAbertos.quantidade > 0"
          />
          <UiStat
            rotulo="No ar"
            :valor="v.galeriasNoAr"
            :detalhe="`galerias · ${v.dispositivosConectados} desktops conectados`"
          />
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <UiCartao titulo="Últimas contas">
          <ul class="divide-y divide-border">
            <li
              v-for="c in v.ultimasContas"
              :key="c.id"
              class="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <NuxtLink :to="`/fotografos/${c.id}`" class="min-w-0">
                <span class="block truncate font-medium hover:text-wine-tint">{{ c.nome }}</span>
                <span class="block truncate text-xs text-muted">@{{ c.slug }} · {{ c.email }}</span>
              </NuxtLink>
              <span class="shrink-0 text-xs text-muted">{{ data(c.criadoEm) }}</span>
            </li>
          </ul>
        </UiCartao>

        <UiCartao titulo="Últimas ações">
          <ul class="divide-y divide-border">
            <li v-for="a in v.ultimasAuditorias" :key="a.id" class="py-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="font-mono text-xs">{{ a.acao }}</span>
                <span class="shrink-0 text-xs text-muted">{{ dataHora(a.criadoEm) }}</span>
              </div>
              <div class="text-xs text-muted">
                {{
                  a.ator ? `${a.ator.nome}${a.ator.papel === 'ADMIN' ? ' (admin)' : ''}` : 'sistema'
                }}
                · {{ a.alvoTipo }}
              </div>
            </li>
          </ul>
        </UiCartao>
      </div>
    </template>
  </div>
</template>
