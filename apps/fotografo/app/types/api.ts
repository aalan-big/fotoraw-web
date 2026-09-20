/** Espelho das respostas do server (apps/server). Quando `packages/contratos` existir, vem de lá. */

export type Papel = 'FOTOGRAFO' | 'ADMIN';
export type StatusConta = 'ATIVA' | 'SUSPENSA' | 'BLOQUEADA';

export interface Conta {
  id: string;
  nome: string;
  email: string;
  slug: string;
  papel: Papel;
  status: StatusConta;
  emailVerificado: boolean;
}

export interface Sessao {
  acesso: string;
  conta: Conta;
}

export interface Perfil {
  contaId: string;
  nomeFantasia: string;
  bio: string | null;
  logoKey: string | null;
  capaKey: string | null;
  whatsapp: string | null;
  instagram: string | null;
  site: string | null;
  cidade: string | null;
  uf: string | null;
  cnpjCpf: string | null;
  chavePix: string | null;
  taxasParaCliente: boolean;
}

export interface RecursosLicenca {
  limite_galerias_ativas: number | null;
  limite_fotos_por_galeria: number | null;
  limite_armazenamento_mb: number | null;
  limite_dispositivos: number | null;
  permite_evento: boolean;
  permite_ensaio: boolean;
  permite_galeria_privada: boolean;
  permite_gestao_estudio: boolean;
}

export interface Licenca {
  id: string | null;
  chave: string | null;
  plano: 'gratuito' | 'trial' | 'pro';
  tipo: 'ASSINATURA' | 'CORTESIA' | 'VITALICIA' | 'TRIAL' | null;
  status?: 'ATIVA' | 'SUSPENSA' | 'REVOGADA' | 'EXPIRADA' | null;
  validaAte: string | null;
  diasRestantes: number | null;
  recursos: RecursosLicenca;
}

export type Pendencia = 'verificar_email' | 'completar_perfil' | 'licenca_vencendo';

export interface Eu {
  conta: Conta;
  perfil: Perfil | null;
  licenca: Licenca;
  pendencias: Pendencia[];
}

export interface Dispositivo {
  id: string;
  nome: string;
  versaoApp: string | null;
  ultimoVistoEm: string;
  criadoEm: string;
  conectado: boolean;
  ultimoUsoEm: string | null;
  tokenExpiraEm: string | null;
}

/** Formato de erro do server (HttpExcecaoFiltro). */
export interface ErroApi {
  status: number;
  codigo: string;
  mensagem: string;
  erros?: { campo: string; mensagem: string }[];
}

export type Modalidade = 'EVENTO' | 'ENSAIO_INTERNO' | 'ENSAIO_EXTERNO';
export type Visibilidade = 'PUBLICA' | 'PRIVADA' | 'PORTFOLIO';
export type ModoVenda = 'AVULSO' | 'PACOTE' | 'ENTREGA';
export type StatusGaleria = 'RASCUNHO' | 'PUBLICADA' | 'PAUSADA' | 'ENCERRADA';
export type StatusFoto = 'ATIVA' | 'OCULTA';

export interface GaleriaResumo {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  categoria: string;
  modoVenda: ModoVenda;
  status: StatusGaleria;
  capaUrl: string | null;
  codigoAcesso: string | null;
  totalFotos: number;
  totalVendasCentavos: number;
  dataEvento: string | null;
  publicadaEm: string | null;
  encerraEm: string | null;
  linkPublico: string;
  criadoEm: string;
}

export interface FotoResumo {
  id: string;
  fotoIdDesktop: string;
  previewUrl: string;
  thumbUrl: string | null;
  largura: number | null;
  altura: number | null;
  numeroIdentificacao: string | null;
  precoCentavos: number | null;
  ordem: number;
  status: StatusFoto;
}

export interface GaleriaDetalhe extends GaleriaResumo {
  temSenha: boolean;
  fotosIncluidas: number | null;
  precoFotoCentavos: number | null;
  precoPacoteCentavos: number | null;
  permiteDownloadGratis: boolean;
  cidade: string | null;
  uf: string | null;
  fotos: FotoResumo[];
}

export interface MetricasGalerias {
  totalGalerias: number;
  totalFotos: number;
  totalVendasCentavos: number;
}

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

export type PeriodicidadePlano = 'MENSAL' | 'ANUAL' | 'NENHUMA';

export interface PlanoCatalogo {
  id: string;
  codigo: string;
  nome: string;
  precoCentavos: number;
  periodicidade: PeriodicidadePlano;
  comissaoEventoPct: number;
  limiteGaleriasAtivas: number | null;
  limiteFotosPorGaleria: number | null;
  limiteArmazenamentoMb: number | null;
  limiteDispositivos: number | null;
  permiteGaleriaPrivada: boolean;
  permiteEvento: boolean;
  permiteEnsaio: boolean;
  permiteGestaoEstudio: boolean;
  ordem: number;
}

export type StatusAssinaturaFotografo =
  | 'TRIAL'
  | 'ATIVA'
  | 'INADIMPLENTE'
  | 'CANCELADA'
  | 'EXPIRADA';

export interface AssinaturaResumo {
  id: string;
  planoId: string;
  planoCodigo: string;
  planoNome: string;
  precoCentavos: number;
  periodicidade: PeriodicidadePlano;
  status: StatusAssinaturaFotografo;
  inicioEm: string;
  periodoAtualInicio: string;
  periodoAtualFim: string;
  cancelaNoFimDoPeriodo: boolean;
  canceladaEm: string | null;
}

export type StatusFaturaFotografo =
  | 'PENDENTE'
  | 'PAGA'
  | 'VENCIDA'
  | 'CANCELADA'
  | 'ESTORNADA';

export interface FaturaResumo {
  id: string;
  valorCentavos: number;
  vencimento: string;
  status: StatusFaturaFotografo;
  pagaEm: string | null;
  urlBoletoPix: string | null;
  criadoEm: string;
}

export interface StatusPlanoFotografo {
  licenca: Licenca;
  assinatura: AssinaturaResumo | null;
  faturas: FaturaResumo[];
  planosDisponiveis: PlanoCatalogo[];
}

export interface AssinarPlanoPayload {
  planoCodigo: 'pro_mensal' | 'pro_anual';
}

export interface CancelarAssinaturaPayload {
  motivo?: string;
}


