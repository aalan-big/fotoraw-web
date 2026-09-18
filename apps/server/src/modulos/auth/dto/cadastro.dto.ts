import { z } from 'zod';
import { emailSchema, senhaSchema, slugSchema } from './comum.js';

export const cadastroSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome ou o do estúdio').max(80),
  email: emailSchema,
  senha: senhaSchema,
  slug: slugSchema,
});

export type CadastroDto = z.infer<typeof cadastroSchema>;
