import { z } from 'zod';
import { emailSchema } from './comum.js';

/** Primeiro login do desktop (docs/fluxos/ambiente-fotografo.md §1). */
export const dispositivoSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1).max(128),
  /** hash do hardware gerado pelo Tauri */
  fingerprint: z.string().trim().min(8).max(128),
  nomeMaquina: z.string().trim().min(1).max(80),
  versaoApp: z.string().trim().max(32).optional(),
});

export type DispositivoDto = z.infer<typeof dispositivoSchema>;
