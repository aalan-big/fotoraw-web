import type { Email } from '../../../infra/email/email.service.js';
import { escapeHtml, layout } from '../emails-cobranca.js';

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Comprador: pagamento confirmado + link da página com os downloads. */
export function emailFotosLiberadas(dados: {
  para: string;
  nome: string;
  numero: number;
  galeria: string;
  fotografo: string;
  quantidade: number;
  totalCentavos: number;
  link: string;
  /** área "Minhas fotos" */
  areaUrl: string;
}): Email {
  const fotos = dados.quantidade === 1 ? '1 foto' : `${dados.quantidade} fotos`;
  const semCusto = dados.totalCentavos === 0;
  return {
    para: dados.para,
    assunto: `Suas fotos de ${dados.galeria} estão liberadas`,
    html: layout(
      semCusto ? 'Seleção confirmada! Suas fotos estão prontas' : 'Pagamento confirmado! Suas fotos estão prontas',
      `<p>Olá, ${escapeHtml(dados.nome.split(' ')[0] ?? dados.nome)}!</p>
       <p>${semCusto ? 'Recebemos a sua seleção' : 'Recebemos o pagamento'} do pedido <strong>#${dados.numero}</strong>.
       Suas fotos em alta resolução, sem marca d'água, já podem ser baixadas.</p>
       <p>Você pode baixar sempre que quiser, enquanto a galeria estiver no ar. Também dá pra
       ver todas as suas compras em <a href="${dados.areaUrl}" style="color:#7a1f2b">Minhas fotos</a>,
       entrando com um código que chega no seu e-mail (sem senha).</p>`,
      dados.link,
      'Baixar minhas fotos',
      [
        { rotulo: 'Galeria', valor: dados.galeria },
        { rotulo: 'Fotógrafo', valor: dados.fotografo },
        { rotulo: 'Fotos', valor: fotos },
        ...(semCusto ? [] : [{ rotulo: 'Total pago', valor: reais(dados.totalCentavos) }]),
      ],
    ),
    texto: `Pagamento do pedido #${dados.numero} confirmado (${fotos}, ${reais(dados.totalCentavos)}). Baixe em: ${dados.link} — ou em ${dados.areaUrl}.`,
  };
}

export type OrigemEstorno = 'devolucao' | 'estorno_mp' | 'contestacao';

/** Comprador: pedido estornado (devolvido) — os downloads param. */
export function emailPedidoEstornado(dados: {
  para: string;
  nome: string;
  numero: number;
  galeria: string;
  totalCentavos: number;
  link: string;
}): Email {
  const pago = dados.totalCentavos > 0;
  return {
    para: dados.para,
    assunto: `Pedido #${dados.numero} cancelado`,
    html: layout(
      pago ? 'Seu pedido foi estornado' : 'Sua seleção foi cancelada',
      `<p>Olá, ${escapeHtml(dados.nome.split(' ')[0] ?? dados.nome)}!</p>
       <p>O pedido <strong>#${dados.numero}</strong> (${escapeHtml(dados.galeria)}) foi cancelado e os
       downloads dele foram desativados.</p>
       ${pago ? `<p>O valor de <strong>${reais(dados.totalCentavos)}</strong> volta pelo mesmo meio de pagamento:
       no Pix, na hora; no cartão, aparece na fatura (pode levar até duas faturas).</p>` : ''}
       <p>Se não reconhece este cancelamento, fale com o fotógrafo.</p>`,
      dados.link,
      'Ver o pedido',
    ),
    texto: `Pedido #${dados.numero} cancelado.${pago ? ` ${reais(dados.totalCentavos)} voltam pelo mesmo meio de pagamento.` : ''}`,
  };
}

/** Fotógrafo: venda estornada (por ele, pelo admin, pelo MP ou contestação no cartão). */
export function emailVendaEstornada(dados: {
  para: string;
  numero: number;
  galeria: string;
  subtotalCentavos: number;
  origem: OrigemEstorno;
  link: string;
}): Email {
  const contestacao = dados.origem === 'contestacao';
  return {
    para: dados.para,
    assunto: contestacao ? `Venda #${dados.numero} contestada no cartão` : `Venda #${dados.numero} estornada`,
    html: layout(
      contestacao ? 'O comprador contestou uma compra no cartão' : 'Uma venda foi estornada',
      contestacao
        ? `<p>O comprador do pedido <strong>#${dados.numero}</strong> contestou a compra com o banco do
           cartão e o Mercado Pago devolveu o valor. Os downloads foram desativados.</p>
           <p>Se a venda foi legítima, você pode responder à contestação pelo seu Mercado Pago.</p>`
        : `<p>O pedido <strong>#${dados.numero}</strong> foi estornado e o valor devolvido ao comprador.
           Os downloads dele foram desativados.</p>`,
      dados.link,
      'Ver minhas vendas',
      [
        { rotulo: 'Galeria', valor: dados.galeria },
        { rotulo: 'Valor da venda', valor: reais(dados.subtotalCentavos) },
      ],
    ),
    texto: `Venda #${dados.numero} ${contestacao ? 'contestada no cartão' : 'estornada'} (${reais(dados.subtotalCentavos)}).`,
  };
}

/** Fotógrafo: venda nova. */
export function emailVendaRealizada(dados: {
  para: string;
  numero: number;
  galeria: string;
  quantidade: number;
  /** pacote: quantas saíram pelo pacote (sem custo) */
  incluidas?: number;
  subtotalCentavos: number;
  comissaoCentavos: number;
  taxaProvedorCentavos: number;
  repasseCentavos: number;
  link: string;
}): Email {
  const fotos = dados.quantidade === 1 ? '1 foto' : `${dados.quantidade} fotos`;
  const incluidas = dados.incluidas ?? 0;
  if (dados.subtotalCentavos === 0) {
    // pacote: o cliente só escolheu as fotos incluídas
    return {
      para: dados.para,
      assunto: `Seleção #${dados.numero}: ${fotos} escolhidas em ${dados.galeria}`,
      html: layout(
        'Seu cliente escolheu as fotos do pacote',
        `<p>A seleção <strong>#${dados.numero}</strong> foi confirmada pelo cliente. As fotos já
         estão liberadas pra ele baixar.</p>`,
        dados.link,
        'Ver no painel',
        [
          { rotulo: 'Galeria', valor: dados.galeria },
          { rotulo: 'Fotos escolhidas', valor: fotos },
        ],
      ),
      texto: `Seleção #${dados.numero}: ${fotos} escolhidas em ${dados.galeria}.`,
    };
  }
  return {
    para: dados.para,
    assunto: `Venda #${dados.numero}: ${fotos} em ${dados.galeria}`,
    html: layout(
      'Você vendeu fotos!',
      `<p>O pedido <strong>#${dados.numero}</strong> foi pago. O valor já está na sua conta do
       Mercado Pago (o prazo de liberação segue a configuração da sua conta lá).</p>`,
      dados.link,
      'Ver minhas vendas',
      [
        { rotulo: 'Galeria', valor: dados.galeria },
        { rotulo: 'Fotos', valor: incluidas ? `${fotos} (${incluidas} do pacote)` : fotos },
        { rotulo: 'Valor da venda', valor: reais(dados.subtotalCentavos) },
        { rotulo: 'Comissão FotoRAW', valor: reais(dados.comissaoCentavos) },
        { rotulo: 'Taxa Mercado Pago', valor: reais(dados.taxaProvedorCentavos) },
        { rotulo: 'Você recebe', valor: reais(dados.repasseCentavos) },
      ],
    ),
    texto: `Venda #${dados.numero}: ${fotos} em ${dados.galeria}. Você recebe ${reais(dados.repasseCentavos)}.`,
  };
}
