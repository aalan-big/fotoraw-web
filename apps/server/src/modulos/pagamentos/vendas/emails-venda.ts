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
  return {
    para: dados.para,
    assunto: `Suas fotos de ${dados.galeria} estão liberadas`,
    html: layout(
      'Pagamento confirmado! Suas fotos estão prontas',
      `<p>Olá, ${escapeHtml(dados.nome.split(' ')[0] ?? dados.nome)}!</p>
       <p>Recebemos o pagamento do pedido <strong>#${dados.numero}</strong>. Suas fotos em alta
       resolução, sem marca d'água, já podem ser baixadas.</p>
       <p>Você pode baixar sempre que quiser, enquanto a galeria estiver no ar. Também dá pra
       ver todas as suas compras em <a href="${dados.areaUrl}" style="color:#7a1f2b">Minhas fotos</a>,
       entrando com o Google ou com um código no seu e-mail.</p>`,
      dados.link,
      'Baixar minhas fotos',
      [
        { rotulo: 'Galeria', valor: dados.galeria },
        { rotulo: 'Fotógrafo', valor: dados.fotografo },
        { rotulo: 'Fotos', valor: fotos },
        { rotulo: 'Total pago', valor: reais(dados.totalCentavos) },
      ],
    ),
    texto: `Pagamento do pedido #${dados.numero} confirmado (${fotos}, ${reais(dados.totalCentavos)}). Baixe em: ${dados.link} — ou em ${dados.areaUrl}.`,
  };
}

/** Fotógrafo: venda nova. */
export function emailVendaRealizada(dados: {
  para: string;
  numero: number;
  galeria: string;
  quantidade: number;
  subtotalCentavos: number;
  comissaoCentavos: number;
  taxaProvedorCentavos: number;
  repasseCentavos: number;
  link: string;
}): Email {
  const fotos = dados.quantidade === 1 ? '1 foto' : `${dados.quantidade} fotos`;
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
        { rotulo: 'Fotos', valor: fotos },
        { rotulo: 'Valor da venda', valor: reais(dados.subtotalCentavos) },
        { rotulo: 'Comissão FotoRAW', valor: reais(dados.comissaoCentavos) },
        { rotulo: 'Taxa Mercado Pago', valor: reais(dados.taxaProvedorCentavos) },
        { rotulo: 'Você recebe', valor: reais(dados.repasseCentavos) },
      ],
    ),
    texto: `Venda #${dados.numero}: ${fotos} em ${dados.galeria}. Você recebe ${reais(dados.repasseCentavos)}.`,
  };
}
