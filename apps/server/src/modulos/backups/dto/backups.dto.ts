import { z } from 'zod';

/** banco do desktop compactado: dezenas de MB num estúdio grande — 1,5 GB é folga */
export const LIMITE_BACKUP_BYTES = 1536 * 1024 * 1024;

export const iniciarBackupSchema = z.object({
  tamanhoBytes: z
    .number()
    .int()
    .positive()
    .max(LIMITE_BACKUP_BYTES, { message: 'O backup passou de 1,5 GB' }),
  sha256: z.string().regex(/^[0-9a-f]{64}$/i, { message: 'sha256 inválido' }),
  versaoApp: z.string().max(40).optional(),
  /** contagens livres pra lista ("ensaios": 38, "clientes": 120…) */
  resumo: z.record(z.string().max(40), z.number().int().min(0)).optional(),
});

export type IniciarBackupDto = z.infer<typeof iniciarBackupSchema>;
