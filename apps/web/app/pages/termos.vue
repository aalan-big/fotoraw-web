<script setup lang="ts">
// RASCUNHO — revisar na Fase 7 (pré-lançamento: termos e LGPD com quem cuida do jurídico).
useSeoMeta({ title: 'Termos de compra', description: 'Como funciona a compra de fotos no FotoRAW.' });

const secoes = [
  {
    titulo: 'Quem vende',
    texto:
      'As fotos são vendidas pelo fotógrafo responsável pela galeria. O FotoRAW é a plataforma que hospeda a galeria, intermedia o pagamento e entrega os arquivos.',
  },
  {
    titulo: 'O que você compra',
    texto:
      'Cada foto comprada é entregue em arquivo digital em alta resolução, sem marca d’água, para uso pessoal (guardar, imprimir, postar nas suas redes). Uso comercial ou revenda dependem de autorização do fotógrafo.',
  },
  {
    titulo: 'Prévias da galeria',
    texto:
      'As fotos da galeria são prévias com marca d’água, feitas só para você escolher o que comprar. Toda foto é protegida por direito autoral desde que foi tirada (Lei 9.610/98): tirar print, remover ou esconder a marca d’água (inclusive com aplicativos de IA) e publicar ou usar a prévia sem comprar são proibidos e podem gerar responsabilidade civil e criminal.',
  },
  {
    titulo: 'Pagamento',
    texto:
      'O pagamento é feito por Pix ou cartão de crédito, processado pelo Mercado Pago. O FotoRAW não vê nem guarda os dados do seu cartão. O valor cobrado é o mostrado no carrinho, sem taxas adicionais.',
  },
  {
    titulo: 'Entrega',
    texto:
      'Assim que o pagamento é confirmado, as fotos ficam disponíveis na página do pedido e o link é enviado para o seu e-mail. Você pode baixar as fotos sempre que quiser enquanto a galeria estiver no ar — pelo link do e-mail ou em Minhas fotos, entrando com o mesmo e-mail (sem senha). Ainda assim, guarde os arquivos no seu aparelho.',
  },
  {
    titulo: 'Problemas com o pedido',
    texto:
      'Se uma foto vier com defeito, for de outra pessoa ou o download não funcionar, fale com o fotógrafo pelos contatos do perfil dele em até 7 dias da compra. Problemas confirmados são resolvidos com a foto certa ou com a devolução do valor da foto.',
  },
  {
    titulo: 'Seus dados',
    texto:
      'Nome, e-mail, WhatsApp e CPF são usados só para processar este pedido, emitir o pagamento e entregar as fotos. Não vendemos nem compartilhamos seus dados para outros fins.',
  },
];
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="text-3xl font-bold tracking-tight">Termos de compra</h1>
    <p class="mt-2 text-muted">Como funciona a compra de fotos no FotoRAW, em poucas palavras.</p>
    <section v-for="s in secoes" :key="s.titulo" class="mt-8">
      <h2 class="text-lg font-semibold">{{ s.titulo }}</h2>
      <p class="mt-2 leading-relaxed text-muted">{{ s.texto }}</p>
    </section>
  </div>
</template>
