import { z } from 'zod';

export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export const listarContasSchema = paginacaoSchema.extend({
  /** nome, e-mail ou @slug */
  q: z.string().trim().max(80).optional(),
  status: z.enum(['ATIVA', 'SUSPENSA', 'BLOQUEADA']).optional(),
  /** derivado da licença ativa */
  plano: z.enum(['gratuito', 'trial', 'pro']).optional(),
});
export type ListarContasDto = z.infer<typeof listarContasSchema>;

export const alterarStatusContaSchema = z.object({
  status: z.enum(['ATIVA', 'SUSPENSA', 'BLOQUEADA']),
  motivo: z.string().trim().min(3).max(300),
});
export type AlterarStatusContaDto = z.infer<typeof alterarStatusContaSchema>;

export const idSchema = z.uuid();
