/**
 * Quais backups ficam: o mais novo de cada um dos últimos 7 dias que tiveram
 * backup + o mais novo de cada uma das últimas 4 semanas. O resto sai.
 * Dia e semana no horário de Brasília (UTC-3, sem horário de verão desde 2019).
 */
const FUSO_MS = 3 * 60 * 60 * 1000;
export const DIAS_GUARDADOS = 7;
export const SEMANAS_GUARDADAS = 4;

function diaLocal(data: Date): string {
  return new Date(data.getTime() - FUSO_MS).toISOString().slice(0, 10);
}

/** segunda-feira da semana do dia local */
function semanaLocal(data: Date): string {
  const local = new Date(data.getTime() - FUSO_MS);
  const recuo = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - recuo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function backupsParaApagar<T extends { id: string; concluidoEm: Date }>(backups: T[]): T[] {
  const ordenados = [...backups].sort((a, b) => b.concluidoEm.getTime() - a.concluidoEm.getTime());
  const ficam = new Set<string>();
  const dias = new Set<string>();
  const semanas = new Set<string>();
  for (const b of ordenados) {
    const dia = diaLocal(b.concluidoEm);
    if (!dias.has(dia) && dias.size < DIAS_GUARDADOS) {
      dias.add(dia);
      ficam.add(b.id);
    }
    const semana = semanaLocal(b.concluidoEm);
    if (!semanas.has(semana) && semanas.size < SEMANAS_GUARDADAS) {
      semanas.add(semana);
      ficam.add(b.id);
    }
  }
  return ordenados.filter((b) => !ficam.has(b.id));
}
