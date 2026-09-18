/** Formatadores pt-BR usados nas tabelas do admin. */
export const dinheiro = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const data = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

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
export const corStatus: Record<string, string> = {
  ATIVA: 'bg-success/15 text-success',
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
