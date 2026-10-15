<script setup lang="ts">
import type { PerfilFotografo } from '~/types/galeria';

// fotoraw.com.br/@slug — o fotógrafo e o que ele tem na vitrine.
const rota = useRoute();
const api = useApi();
const slug = computed(() => String(rota.params.slug).replace(/^@/, ''));

const { data: perfil, error } = await useAsyncData(
  () => `fotografo-${slug.value}`,
  () => api<PerfilFotografo>(`/publico/fotografos/${slug.value}`),
);
if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: 'Fotógrafo não encontrado',
    fatal: true,
  });
}

const local = computed(() => [perfil.value?.cidade, perfil.value?.uf].filter(Boolean).join('/'));
const whatsapp = computed(() => {
  const n = perfil.value?.whatsapp?.replace(/\D/g, '');
  if (!n) return null;
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}`;
});
const instagram = computed(() => {
  const i = perfil.value?.instagram?.replace(/^@/, '').trim();
  return i ? `https://instagram.com/${i}` : null;
});

useSeoMeta({
  title: () => perfil.value?.nome ?? 'Fotógrafo',
  description: () => perfil.value?.bio || `Galerias de ${perfil.value?.nome ?? 'fotógrafo'} no FotoRAW.`,
  ogImage: () => perfil.value?.capaUrl ?? perfil.value?.galerias[0]?.capaUrl ?? undefined,
});
</script>

<template>
  <div v-if="perfil" class="pb-20">
    <section class="relative overflow-hidden border-b border-border">
      <img
        v-if="perfil.capaUrl ?? perfil.galerias[0]?.capaUrl"
        :src="(perfil.capaUrl ?? perfil.galerias[0]?.capaUrl)!"
        alt=""
        aria-hidden="true"
        class="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-2xl"
      />
      <div class="absolute inset-0 bg-linear-to-b from-bg/40 to-bg" />
      <div class="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-14 md:flex-row md:items-center">
        <img v-if="perfil.logoUrl" :src="perfil.logoUrl" alt="" class="size-20 rounded-full border border-border object-cover" />
        <span
          v-else
          class="flex size-20 items-center justify-center rounded-full bg-wine-dim text-2xl font-bold text-wine-tint"
        >
          {{ iniciais(perfil.nome) }}
        </span>
        <div class="min-w-0">
          <h1 class="text-3xl font-bold tracking-tight md:text-4xl">{{ perfil.nome }}</h1>
          <p class="mt-1 text-sm text-muted">
            @{{ perfil.slug }}<template v-if="local"> · {{ local }}</template>
          </p>
          <p v-if="perfil.bio" class="mt-3 max-w-2xl text-muted">{{ perfil.bio }}</p>
          <div v-if="whatsapp || instagram || perfil.site" class="mt-4 flex flex-wrap gap-2">
            <UiBotao v-if="whatsapp" :to="whatsapp" variante="secundaria">WhatsApp</UiBotao>
            <UiBotao v-if="instagram" :to="instagram" variante="secundaria">Instagram</UiBotao>
            <UiBotao v-if="perfil.site" :to="perfil.site" variante="secundaria">Site</UiBotao>
          </div>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-6xl px-6 pt-10">
      <h2 class="text-xl font-semibold">Galerias</h2>
      <div v-if="perfil.galerias.length" class="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <GaleriaCartao v-for="g in perfil.galerias" :key="g.id" :galeria="g" />
      </div>
      <div v-else class="card mt-6 px-6 py-16 text-center text-muted">
        Nenhuma galeria aberta no momento.
      </div>
    </div>
  </div>
</template>
