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
  permite_galeria_privada: boolean;
  permite_evento: boolean;
}

export interface Licenca {
  id: string | null;
  chave: string | null;
  plano: 'gratuito' | 'trial' | 'pro';
  tipo: 'ASSINATURA' | 'CORTESIA' | 'VITALICIA' | 'TRIAL' | null;
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
