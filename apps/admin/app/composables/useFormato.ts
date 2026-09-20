/** Formatadores pt-BR usados nas tabelas do admin. */
export const dinheiro = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const data = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

/** Datas de calendário (DATE no banco, meia-noite UTC): formata sem converter pro fuso local. */
export const dataDia = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export const dataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const rotuloTipoLicenca: Record<string, string> = {
  ASSINATURA: 'Assinatura',
  CORTESIA: 'Cortesia',
  VITALICIA: 'Vitalícia',
  TRIAL: 'Trial',
};
export const rotuloStatus: Record<string, string> = {
  ATIVA: 'Ativa',
  SUSPENSA: 'Suspensa',
  BLOQUEADA: 'Bloqueada',
  REVOGADA: 'Revogada',
  EXPIRADA: 'Expirada',
};
export const rotuloStatusAssinatura: Record<string, string> = {
  TRIAL: 'Trial',
  ATIVA: 'Ativa',
  INADIMPLENTE: 'Inadimplente',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
};
export const rotuloStatusFatura: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGA: 'Paga',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
  ESTORNADA: 'Estornada',
};
export const corStatus: Record<string, string> = {
  ATIVA: 'bg-success/15 text-success',
  PAGA: 'bg-success/15 text-success',
  PENDENTE: 'bg-info/15 text-info',
  INADIMPLENTE: 'bg-danger/15 text-danger',
  VENCIDA: 'bg-danger/15 text-danger',
  CANCELADA: 'bg-surface-2 text-muted',
  ESTORNADA: 'bg-warning/15 text-warning',
  TRIAL: 'bg-info/15 text-info',
  SUSPENSA: 'bg-warning/15 text-warning',
  BLOQUEADA: 'bg-danger/15 text-danger',
  REVOGADA: 'bg-danger/15 text-danger',
  EXPIRADA: 'bg-surface-2 text-muted',
};
export const corPlano: Record<string, string> = {
  gratuito: 'bg-surface-2 text-muted',
  trial: 'bg-info/15 text-info',
  pro: 'bg-wine-dim text-wine-tint',
};
