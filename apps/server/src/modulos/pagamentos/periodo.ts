import type { Plano } from '../../infra/prisma/gerado/client.js';

/**
 * Datas de período/vencimento são "dias de calendário" guardados como DATE (meia-noite
 * UTC no Prisma). `new Date()` vem no fuso local: usa as partes locais pra achar o dia.
 */
export function inicioDoDia(d: Date, deLocal = false): Date {
  return deLocal
    ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function somarPeriodo(inicio: Date, periodicidade: Plano['periodicidade']): Date {
  const fim = new Date(inicio);
  if (periodicidade === 'ANUAL') fim.setUTCFullYear(fim.getUTCFullYear() + 1);
  else fim.setUTCMonth(fim.getUTCMonth() + 1);
  return fim;
}
