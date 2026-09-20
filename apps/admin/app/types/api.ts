/** Espelho das respostas do server (apps/server, módulos auth/licencas/admin). */

export type Papel = 'FOTOGRAFO' | 'ADMIN';
export type StatusConta = 'ATIVA' | 'SUSPENSA' | 'BLOQUEADA';
export type TipoLicenca = 'ASSINATURA' | 'CORTESIA' | 'VITALICIA' | 'TRIAL';
export type StatusLicenca = 'ATIVA' | 'SUSPENSA' | 'REVOGADA' | 'EXPIRADA';

export interface Conta {
  id: string;
  nome: string;
  email: string;
  slug: string;
  papel: Papel;
  status: StatusConta;
  emailVerificado: boolean;
  totpAtivo: boolean;
}

export interface Sessao {
  acesso: string;
  conta: Conta;
}
/** login do admin com 2FA ligado: senha passou, falta o código */
export interface Desafio2fa {
  precisa2fa: true;
  desafio: string;
}

export interface Estado2fa {
  ativo: boolean;
  ativadoEm: string | null;
  pendente: boolean;
  codigosRestantes: number;
}
export interface AdminLista {
  id: string;
  nome: string;
  email: string;
  status: StatusConta;
  criadoEm: string;
  totpAtivo: boolean;
  ultimoLoginEm: string | null;
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
  id: string;
  contaId: string;
  assinaturaId: string | null;
  chave: string;
  tipo: TipoLicenca;
  status: StatusLicenca;
  validaAte: string | null;
  recursos: RecursosLicenca;
  emitidaPorId: string | null;
  motivo: string | null;
  emitidaEm: string;
  atualizadaEm: string;
  conta?: { id: string; nome: string; email: string; slug: string; status: StatusConta };
}

export interface LicencaAtual {
  id: string | null;
  chave: string | null;
  plano: 'gratuito' | 'trial' | 'pro';
  tipo: TipoLicenca | null;
  validaAte: string | null;
  diasRestantes: number | null;
  recursos: RecursosLicenca;
}

export interface Plano {
  id: string;
  codigo: string;
  nome: string;
  precoCentavos: number;
  periodicidade: 'MENSAL' | 'ANUAL' | 'NENHUMA';
  comissaoEventoPct: number;
  limiteGaleriasAtivas: number | null;
  limiteFotosPorGaleria: number | null;
  limiteArmazenamentoMb: number | null;
  limiteDispositivos: number | null;
  permiteEvento: boolean;
  permiteEnsaio: boolean;
  permiteGaleriaPrivada: boolean;
  permiteGestaoEstudio: boolean;
  ativo: boolean;
  ordem: number;
  /** licenças ATIVAS emitidas a partir deste plano (trial, cortesia, assinatura) */
  licencasAtivas: number;
}

export interface Configuracao {
  chave: string;
  grupo: 'licencas' | 'vendas' | 'downloads' | 'contato';
  rotulo: string;
  descricao: string;
  tipo: 'inteiro' | 'percentual' | 'email';
  valor: number | string;
  padrao: number | string;
  atualizadoEm: string | null;
}

export interface Paginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ContaLista {
  id: string;
  nome: string;
  email: string;
  slug: string;
  status: StatusConta;
  emailVerificado: boolean;
  criadoEm: string;
  plano: 'gratuito' | 'trial' | 'pro';
  licenca: { tipo: TipoLicenca; validaAte: string | null; chave: string } | null;
  galerias: number;
  dispositivos: number;
}

export interface Auditoria {
  id: string;
  acao: string;
  alvoTipo: string;
  alvoId: string;
  antes: unknown;
  depois: unknown;
  ip: string | null;
  criadoEm: string;
  ator: { id: string; nome: string; papel: Papel } | null;
}

export interface ContaDetalhe {
  conta: Conta & {
    criadoEm: string;
    emailVerificadoEm: string | null;
    perfil: Record<string, unknown> | null;
  };
  licencaAtual: LicencaAtual;
  licencas: Licenca[];
  dispositivos: {
    id: string;
    nome: string;
    versaoApp: string | null;
    ultimoVistoEm: string;
    conectado: boolean;
    ultimoUsoEm: string | null;
  }[];
  galerias: {
    id: string;
    titulo: string;
    slug: string;
    modalidade: string;
    visibilidade: string;
    status: string;
    totalFotos: number;
    publicadaEm: string | null;
  }[];
  totais: { galerias: number; pedidos: number };
  vendas: {
    pedidosPagos: number;
    totalCentavos: number;
    comissaoCentavos: number;
    repasseCentavos: number;
  };
  auditorias: Auditoria[];
}

export interface ResumoConta {
  conta: {
    id: string;
    nome: string;
    email: string;
    slug: string;
    status: StatusConta;
    emailVerificado: boolean;
    criadoEm: string;
  };
  licenca: LicencaAtual;
  saude: {
    nivel: 'ok' | 'atencao' | 'critico';
    alertas: { codigo: string; nivel: 'atencao' | 'critico'; texto: string }[];
  };
  uso: {
    galeriasAtivas: number;
    limiteGalerias: number | null;
    fotos: number;
    armazenamentoMb: number;
    limiteArmazenamentoMb: number | null;
    dispositivosConectados: number;
    limiteDispositivos: number | null;
    vendas30d: { pedidos: number; totalCentavos: number; comissaoCentavos: number };
    ultimoLoginEm: string | null;
    ultimoDesktopEm: string | null;
    ultimaPublicacaoEm: string | null;
  };
  linhaDoTempo: { quando: string; tipo: string; texto: string; ator?: string | null }[];
}

export type StatusAssinatura = 'TRIAL' | 'ATIVA' | 'INADIMPLENTE' | 'CANCELADA' | 'EXPIRADA';
export type StatusFatura = 'PENDENTE' | 'PAGA' | 'VENCIDA' | 'CANCELADA' | 'ESTORNADA';

export interface Fatura {
  id: string;
  valorCentavos: number;
  vencimento: string;
  status: StatusFatura;
  pagaEm: string | null;
  urlBoletoPix: string | null;
  criadoEm: string;
}

export interface AssinaturaLista {
  id: string;
  status: StatusAssinatura;
  inicioEm: string;
  periodoAtualInicio: string;
  periodoAtualFim: string;
  canceladaEm: string | null;
  cancelaNoFimDoPeriodo: boolean;
  provedor: 'MERCADOPAGO' | 'STRIPE' | 'MANUAL';
  origem: 'SITE' | 'ADMIN';
  observacaoAdmin: string | null;
  criadoEm: string;
  conta: { id: string; nome: string; email: string; slug: string; status: StatusConta };
  plano: {
    id: string;
    codigo: string;
    nome: string;
    precoCentavos: number;
    periodicidade: 'MENSAL' | 'ANUAL' | 'NENHUMA';
  };
  proximaFatura: Pick<Fatura, 'id' | 'valorCentavos' | 'vencimento' | 'status'> | null;
}

export interface AssinaturasPaginado extends Paginado<AssinaturaLista> {
  numeros: { ativas: number; mrrCentavos: number; faturasVencidas: number };
}

export interface AssinaturaDetalhe extends Omit<AssinaturaLista, 'proximaFatura'> {
  faturas: Fatura[];
  licencas: {
    id: string;
    chave: string;
    status: StatusLicenca;
    validaAte: string | null;
    emitidaEm: string;
  }[];
}

export interface FinanceiroResumo {
  periodo: { de: string; ate: string };
  vendas: {
    pedidos: number;
    totalCentavos: number;
    comissaoCentavos: number;
    taxasCentavos: number;
    repasseCentavos: number;
    estornos: number;
    estornadoCentavos: number;
  };
  assinaturas: { faturasPagas: number; recebidoCentavos: number };
  aRepassar: { contas: number; totalCentavos: number; repassesAbertos: number };
  porDia: { dia: string; pedidos: number; totalCentavos: number; comissaoCentavos: number }[];
  porConta: {
    conta: { id: string; nome: string; slug: string };
    pedidos: number;
    totalCentavos: number;
    comissaoCentavos: number;
    repasseCentavos: number;
  }[];
}

export interface SaldoConta {
  conta: { id: string; nome: string; slug: string; email: string; status: StatusConta };
  chavePix: string | null;
  pedidosPagos: number;
  vendidoCentavos: number;
  comissaoCentavos: number;
  devidoCentavos: number;
  repassadoCentavos: number;
  saldoCentavos: number;
  repassesAbertos: number;
  ultimaVendaEm: string | null;
  ultimoRepasseEm: string | null;
}

export type StatusRepasse = 'ABERTO' | 'SOLICITADO' | 'PAGO' | 'FALHOU';
export interface Repasse {
  id: string;
  status: StatusRepasse;
  metodo: 'SPLIT_AUTOMATICO' | 'PIX_MANUAL';
  valorCentavos: number;
  periodoInicio: string;
  periodoFim: string;
  pagoEm: string | null;
  provedorTransferenciaId: string | null;
  criadoEm: string;
  conta: { id: string; nome: string; slug: string };
  chavePix: string | null;
}

export interface AuditoriaItem extends Auditoria {
  rotulo: string;
  alvoConta: { id: string; nome: string; slug: string } | null;
  ator: { id: string; nome: string; email: string; papel: Papel } | null;
}
export interface AcaoAuditoria {
  acao: string;
  rotulo: string;
  total: number;
}

export interface SaudeSistema {
  ambiente: string;
  versaoNode: string;
  noArHaSegundos: number;
  memoriaMb: number;
  banco: 'ok' | 'erro';
  email: 'configurado' | 'so_log';
  storage: 'configurado' | 'ausente';
  webhooks: { comErro: number; pendentes: number; ultimoEm: string | null };
  sync: { comErro: number; travados: number; ultimoEm: string | null };
}
export interface WebhookRecebido {
  id: string;
  provedor: 'MERCADOPAGO' | 'STRIPE' | 'MANUAL';
  eventoRef: string;
  tipo: string;
  payload: unknown;
  processadoEm: string | null;
  erro: string | null;
  criadoEm: string;
}
export interface SyncLote {
  id: string;
  tipo: 'PUBLICAR' | 'ATUALIZAR_FOTOS' | 'DESPUBLICAR' | 'PUXAR_PEDIDOS';
  status: 'RECEBIDO' | 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
  totalItens: number;
  itensOk: number;
  itensErro: number;
  erro: string | null;
  iniciadoEm: string;
  concluidoEm: string | null;
  conta: { id: string; nome: string; slug: string };
  galeria: { id: string; titulo: string; slug: string } | null;
}

export interface VisaoGeral {
  contas: {
    ativas: number;
    suspensas: number;
    bloqueadas: number;
    novasNos30Dias: number;
    semVerificarEmail: number;
  };
  licencas: {
    trial: number;
    assinatura: number;
    cortesia: number;
    vitalicia: number;
    trialsVencendoEm7Dias: number;
  };
  assinaturasAtivas: number;
  vendasMes: { pedidos: number; totalCentavos: number; comissaoCentavos: number };
  repassesAbertos: { quantidade: number; valorCentavos: number };
  webhooksComErro: number;
  dispositivosConectados: number;
  galeriasNoAr: number;
  ultimasContas: {
    id: string;
    nome: string;
    slug: string;
    email: string;
    criadoEm: string;
    emailVerificado: boolean;
  }[];
  ultimasAuditorias: Auditoria[];
}

export interface ErroApi {
  status: number;
  codigo: string;
  mensagem: string;
  erros?: { campo: string; mensagem: string }[];
}
