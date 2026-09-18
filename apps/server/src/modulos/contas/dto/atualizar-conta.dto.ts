import { z } from 'zod';
import { emailSchema } from '../../auth/dto/comum.js';

/** Nome muda na hora; e-mail novo só vale depois do link de confirmação. */
export const atualizarContaSchema = z
  .object({
    nome: z.string().trim().min(2).max(80).optional(),
    email: emailSchema.optional(),
  })
  .refine((d) => d.nome !== undefined || d.email !== undefined, { message: 'Nada pra atualizar' });

export type AtualizarContaDto = z.infer<typeof atualizarContaSchema>;
