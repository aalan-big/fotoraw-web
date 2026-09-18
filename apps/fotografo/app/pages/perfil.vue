<script setup lang="ts">
import type { Perfil } from '~/types/api';

definePageMeta({ layout: 'painel', middleware: 'autenticado' });
useSeoMeta({ title: 'Perfil público' });

const api = useApi();
const sessao = useSessao();
const { webUrl } = useRuntimeConfig().public;

const { data: perfil, status } = await useAsyncData('perfil', () =>
  api<Perfil | null>('/me/perfil'),
);

const form = reactive({
  nomeFantasia: '',
  bio: '',
  whatsapp: '',
  instagram: '',
  site: '',
  cidade: '',
  uf: '',
  cnpjCpf: '',
  chavePix: '',
  taxasParaCliente: false,
});
watch(
  perfil,
  (p) => {
    if (!p) return;
    form.nomeFantasia = p.nomeFantasia;
    form.bio = p.bio ?? '';
    form.whatsapp = p.whatsapp ?? '';
    form.instagram = p.instagram ?? '';
    form.site = p.site ?? '';
    form.cidade = p.cidade ?? '';
    form.uf = p.uf ?? '';
    form.cnpjCpf = p.cnpjCpf ?? '';
    form.chavePix = p.chavePix ?? '';
    form.taxasParaCliente = p.taxasParaCliente;
  },
  { immediate: true },
);

const salvando = ref(false);
const salvo = ref(false);
const erro = ref('');
const erros = ref<Record<string, string>>({});

async function salvar() {
  salvando.value = true;
  salvo.value = false;
  erro.value = '';
  erros.value = {};
  const vazioVira = (v: string) => (v.trim() === '' ? null : v.trim());
  try {
    perfil.value = await api<Perfil>('/me/perfil', {
      method: 'PUT',
      body: {
        nomeFantasia: form.nomeFantasia,
        bio: vazioVira(form.bio),
        whatsapp: vazioVira(form.whatsapp),
        instagram: vazioVira(form.instagram),
        site: vazioVira(form.site),
        cidade: vazioVira(form.cidade),
        uf: vazioVira(form.uf),
        cnpjCpf: vazioVira(form.cnpjCpf),
        chavePix: vazioVira(form.chavePix),
        taxasParaCliente: form.taxasParaCliente,
      },
    });
    await sessao.carregarEu().catch(() => null);
    salvo.value = true;
  } catch (e) {
    const apiErro = lerErroApi(e);
    erros.value = errosPorCampo(apiErro);
    if (!apiErro.erros?.length) erro.value = apiErro.mensagem;
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <form class="mx-auto max-w-3xl space-y-6" @submit.prevent="salvar">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Perfil público</h1>
        <p class="text-sm text-muted">
          O que aparece em
          <a
            :href="`${webUrl}/@${sessao.conta?.slug}`"
            target="_blank"
            class="text-wine-tint hover:underline"
          >
            fotoraw.com.br/@{{ sessao.conta?.slug }}
          </a>
        </p>
      </div>
      <UiBotao type="submit" :disabled="salvando || status === 'pending'">
        {{ salvando ? 'Salvando…' : 'Salvar' }}
      </UiBotao>
    </div>

    <UiAlerta v-if="erro" tipo="erro">{{ erro }}</UiAlerta>
    <UiAlerta v-if="salvo" tipo="sucesso">Perfil salvo.</UiAlerta>

    <UiCartao titulo="Como você aparece">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiCampo
          v-model="form.nomeFantasia"
          rotulo="Nome do estúdio"
          required
          :erro="erros.nomeFantasia"
          class="sm:col-span-2"
        />
        <UiCampo
          v-model="form.bio"
          rotulo="Bio"
          :linhas="3"
          :maxlength="600"
          :erro="erros.bio"
          placeholder="Fotografia de corrida de rua e trail em Curitiba desde 2015."
          class="sm:col-span-2"
        />
        <UiCampo v-model="form.cidade" rotulo="Cidade" :erro="erros.cidade" />
        <UiCampo v-model="form.uf" rotulo="UF" :maxlength="2" placeholder="PR" :erro="erros.uf" />
        <UiCampo
          v-model="form.whatsapp"
          rotulo="WhatsApp"
          type="tel"
          placeholder="(41) 99999-1234"
          :erro="erros.whatsapp"
          ajuda="Com DDD. Vira botão 'Fale comigo' na vitrine."
        />
        <UiCampo
          v-model="form.instagram"
          rotulo="Instagram"
          placeholder="@estudio"
          :erro="erros.instagram"
        />
        <UiCampo
          v-model="form.site"
          rotulo="Site"
          type="url"
          placeholder="https://"
          :erro="erros.site"
          class="sm:col-span-2"
        />
      </div>
      <p class="mt-4 text-xs text-muted">
        Logo e capa: em breve (junto com o armazenamento de imagens).
      </p>
    </UiCartao>

    <UiCartao
      titulo="Dados pra receber"
      descricao="Usados no repasse e na nota. Não aparecem na vitrine."
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UiCampo
          v-model="form.cnpjCpf"
          rotulo="CPF ou CNPJ"
          :erro="erros.cnpjCpf"
          placeholder="000.000.000-00"
        />
        <UiCampo
          v-model="form.chavePix"
          rotulo="Chave Pix"
          :erro="erros.chavePix"
          ajuda="Só se o repasse for manual; com Mercado Pago conectado o dinheiro cai direto."
        />
      </div>

      <label class="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
        <input v-model="form.taxasParaCliente" type="checkbox" class="mt-0.5 size-4 accent-wine" />
        <span class="text-sm">
          <span class="font-medium">Repassar a taxa do pagamento pro cliente</span>
          <span class="mt-0.5 block text-muted">
            Ligado: a taxa do Pix/cartão entra no total do cliente. Desligado: você absorve. A
            comissão da plataforma (10%) é sempre sobre o subtotal.
          </span>
        </span>
      </label>
    </UiCartao>
  </form>
</template>
