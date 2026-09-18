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
}

export interface Sessao {
  acesso: string;
  conta: Conta;
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
