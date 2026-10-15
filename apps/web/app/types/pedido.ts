// Espelho de GET /api/publico/pedidos/:id (apps/server/src/modulos/pagamentos/vendas).

export type StatusPedido =
  | 'ABERTO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGO'
  | 'CANCELADO'
  | 'EXPIRADO'
  | 'ESTORNADO';

export interface ItemPedido {
  fotoId: string;
  numero: string | null;
  precoCentavos: number;
  miniaturaUrl: string | null;
  /** só existe depois de pago */
  download: { token: string; baixadas: number; limite: number; expiraEm: string } | null;
}

export interface Pedido {
  id: string;
  numero: number;
  status: StatusPedido;
  subtotalCentavos: number;
  totalCentavos: number;
  expiraEm: string | null;
  pagoEm: string | null;
  galeria: { id: string; titulo: string; slug: string; contaSlug: string; fotografo: string };
  comprador: { nome: string; email: string };
  /** public_key do fotógrafo — o formulário de cartão tokeniza com ela */
  publicKey: string | null;
  pix: { copiaCola: string | null; qrBase64: string | null; expiraEm: string | null } | null;
  /** o último cartão tentado foi recusado */
  ultimaRecusa: boolean;
  itens: ItemPedido[];
  /** só na resposta do POST cartão */
  cartao?: { status: string; detalhe: string | null };
}
