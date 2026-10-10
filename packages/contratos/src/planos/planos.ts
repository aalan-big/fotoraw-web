export type PeriodicidadePlano = 'MENSAL' | 'ANUAL' | 'NENHUMA';

export interface RecursosLicencaResumo {
  limite_galerias_ativas: number | null;
  limite_fotos_por_galeria: number | null;
  limite_armazenamento_mb: number | null;
  limite_dispositivos: number | null;
  permite_evento: boolean;
  permite_ensaio: boolean;
  permite_galeria_privada: boolean;
  permite_gestao_estudio: boolean;
}

export interface LicencaResumo {
  id: string | null;
  chave: string | null;
  plano: 'gratuito' | 'trial' | 'pro';
  /** plano de origem (gratuito, evento_mensal, pro_mensal…) */
  planoCodigo: string | null;
  /** "Evento", "PRO", "Business"… */
  planoNome: string | null;
  tipo: 'ASSINATURA' | 'CORTESIA' | 'VITALICIA' | 'TRIAL' | null;
  status: 'ATIVA';
  validaAte: string | null;
  diasRestantes: number | null;
  recursos: RecursosLicencaResumo;
}

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
  /** pedida mas nenhuma fatura paga ainda — o PRO não está liberado */
  aguardandoPagamento: boolean;
  /** cobrada todo mês no cartão pelo Mercado Pago (false = manual) */
  cobrancaAutomatica: boolean;
  /** checkout do MP pra cadastrar o cartão, enquanto aguarda o 1º pagamento */
  linkPagamento: string | null;
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
  licenca: LicencaResumo;
  assinatura: AssinaturaResumo | null;
  faturas: FaturaResumo[];
  planosDisponiveis: PlanoCatalogo[];
}

export interface AssinarPlanoPayload {
  /** código de um plano pago e ativo do catálogo */
  planoCodigo: string;
}

export interface CancelarAssinaturaPayload {
  motivo?: string;
}
