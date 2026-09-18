import { z } from 'zod';
import { senhaSchema } from '../../auth/dto/comum.js';

export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1).max(128),
  novaSenha: senhaSchema,
});

export type AlterarSenhaDto = z.infer<typeof alterarSenhaSchema>;
