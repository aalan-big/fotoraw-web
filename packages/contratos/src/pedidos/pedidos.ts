export type StatusPedido =
  | 'ABERTO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGO'
  | 'CANCELADO'
  | 'EXPIRADO'
  | 'ESTORNADO';

export type MetodoPagamento = 'PIX' | 'CARTAO' | 'BOLETO';
export type StatusPagamento =
  | 'CRIADO'
  | 'PENDENTE'
  | 'APROVADO'
  | 'RECUSADO'
  | 'ESTORNADO'
  | 'EXPIRADO';

export interface CompradorResumo {
  nome: string;
  email: string;
  whatsapp: string | null;
  cpf?: string | null;
}

export interface ItemPedidoResumo {
  id: string;
  fotoId: string;
  fotoIdDesktop: string;
  previewUrl: string;
  numeroIdentificacao: string | null;
  precoCentavos: number;
  incluida: boolean;
  downloadsRestantes?: number;
  limiteDownloads?: number;
}

export interface PagamentoResumo {
  id: string;
  metodo: MetodoPagamento;
  status: StatusPagamento;
  valorCentavos: number;
  pixCopiaCola?: string | null;
  aprovadoEm?: string | null;
  criadoEm: string;
}

export interface PedidoResumo {
  id: string;
  numero: number;
  galeriaId: string;
  galeriaTitulo: string;
  compradorNome: string;
  compradorEmail: string;
  compradorWhatsapp: string | null;
  totalItens: number;
  subtotalCentavos: number;
  descontoCentavos: number;
  taxaClienteCentavos: number;
  totalCentavos: number;
  comissaoPct: number;
  comissaoCentavos: number;
  taxaProvedorCentavos: number | null;
  repasseCentavos: number;
  status: StatusPedido;
  metodoPagamento: MetodoPagamento | null;
  pagoEm: string | null;
  criadoEm: string;
}

export interface PedidoDetalhe extends PedidoResumo {
  comprador: CompradorResumo;
  itens: ItemPedidoResumo[];
  pagamentos: PagamentoResumo[];
}

export interface MetricasVendas {
  totalFaturadoCentavos: number;
  totalRepasseCentavos: number;
  totalComissaoCentavos: number;
  totalPedidosPagos: number;
  totalPedidosPendentes: number;
  totalPedidosCancelados: number;
  ticketMedioCentavos: number;
}
