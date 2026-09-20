export type StatusRepasse = 'ABERTO' | 'SOLICITADO' | 'PAGO' | 'FALHOU';
export type MetodoRepasse = 'SPLIT_AUTOMATICO' | 'PIX_MANUAL';

export interface ConexaoMercadoPagoResumo {
  conectado: boolean;
  rotulo?: string | null;
  provedorUsuarioId?: string | null;
  conectadoEm?: string | null;
}

export interface ConfiguracaoTaxas {
  taxasParaCliente: boolean;
  chavePix: string | null;
  cnpjCpf: string | null;
}

export interface SaldoFotografo {
  saldoDisponivelCentavos: number;
  saldoTotalRepassadoCentavos: number;
  totalVendasBrutoCentavos: number;
  totalComissaoCentavos: number;
  totalPedidosPagos: number;
  conexaoMercadoPago: ConexaoMercadoPagoResumo;
  configuracao: ConfiguracaoTaxas;
}

export interface RepasseResumo {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  valorCentavos: number;
  status: StatusRepasse;
  metodo: MetodoRepasse;
  provedorTransferenciaId: string | null;
  pagoEm: string | null;
  comprovanteKey: string | null;
  criadoEm: string;
}

export interface AtualizarTaxasPayload {
  taxasParaCliente?: boolean;
  chavePix?: string | null;
  cnpjCpf?: string | null;
}
