<script setup lang="ts">
// RASCUNHO — revisar com quem cuida do jurídico antes do lançamento (LGPD).
// O e-mail de contato vem de NUXT_PUBLIC_CONTATO_EMAIL; vazio = a linha some.
useSeoMeta({ title: 'Privacidade', description: 'Como o FotoRAW trata os seus dados.' });
const { contatoEmail } = useRuntimeConfig().public;

const secoes = [
  {
    titulo: 'Quem somos',
    paragrafos: [
      'O FotoRAW é uma plataforma onde fotógrafos publicam galerias e vendem fotos. Nesta página explicamos, em linguagem simples, quais dados usamos, por quê e o que você pode pedir.',
    ],
  },
  {
    titulo: 'Se você compra fotos',
    paragrafos: [
      'Pedimos nome, e-mail, WhatsApp (opcional) e CPF. O e-mail é onde chegam as suas fotos; o CPF é exigido pelo Mercado Pago para o pagamento.',
      'Guardamos o pedido (quais fotos, valor, data) e quantas vezes cada foto foi baixada. Não guardamos dados de cartão: o pagamento é feito no formulário do Mercado Pago.',
      'O fotógrafo da galeria vê o seu nome, e-mail e WhatsApp no pedido, para poder te atender.',
    ],
  },
  {
    titulo: 'Se você é fotógrafo',
    paragrafos: [
      'Guardamos os dados da sua conta, do seu perfil público, as fotos que você publica e os dados de vendas e repasses.',
      'Quando você conecta o Mercado Pago, guardamos as chaves de acesso de forma criptografada — só para criar as cobranças das suas vendas.',
    ],
  },
  {
    titulo: 'Fotos de pessoas',
    paragrafos: [
      'As galerias mostram prévias com marca d’água. Se você aparece numa foto e não quer que ela fique na vitrine, fale com o fotógrafo da galeria (os contatos estão no perfil dele) ou com a gente — a foto sai do ar.',
    ],
  },
  {
    titulo: 'Com quem compartilhamos',
    paragrafos: [
      'Mercado Pago (pagamentos), Cloudflare (hospedagem das fotos e proteção do site) e o serviço que envia os nossos e-mails. Cada um recebe só o necessário para fazer a sua parte. Não vendemos dados.',
    ],
  },
  {
    titulo: 'Por quanto tempo',
    paragrafos: [
      'Os dados de pedidos e pagamentos são guardados pelo prazo que a lei exige para registros financeiros. Os demais ficam enquanto você usar o FotoRAW ou até você pedir para apagar.',
    ],
  },
  {
    titulo: 'Navegador',
    paragrafos: [
      'Usamos o armazenamento do seu navegador para lembrar o carrinho e manter você conectado em “Minhas fotos”. Não usamos cookies de propaganda.',
    ],
  },
  {
    titulo: 'Seus direitos',
    paragrafos: [
      'Você pode ver os dados das suas compras e apagar seus dados pessoais em Minhas fotos, entrando com o seu e-mail (sem senha). Os pedidos continuam registrados, mas sem o seu nome, e-mail, WhatsApp ou CPF.',
      'Para corrigir dados, tirar dúvidas ou fazer qualquer outro pedido sobre os seus dados, fale com a gente.',
    ],
  },
];
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="text-3xl font-bold tracking-tight">Privacidade</h1>
    <p class="mt-2 text-muted">Como o FotoRAW trata os seus dados.</p>
    <section v-for="s in secoes" :key="s.titulo" class="mt-8">
      <h2 class="text-lg font-semibold">{{ s.titulo }}</h2>
      <p v-for="(t, i) in s.paragrafos" :key="i" class="mt-2 leading-relaxed text-muted">{{ t }}</p>
    </section>
    <div class="card mt-10 flex flex-wrap items-center justify-between gap-4 p-5">
      <p class="text-sm text-muted">
        Comprou fotos? Veja ou apague seus dados em <strong class="text-text">Minhas fotos</strong>.
        <template v-if="contatoEmail">
          Outros pedidos: <a :href="`mailto:${contatoEmail}`" class="text-wine-tint hover:underline">{{ contatoEmail }}</a>.
        </template>
      </p>
      <UiBotao to="/minhas-fotos" variante="secundaria">Minhas fotos</UiBotao>
    </div>
  </div>
</template>
