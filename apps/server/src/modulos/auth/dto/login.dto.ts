import { z } from 'zod';
import { emailSchema } from './comum.js';

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1).max(128),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const login2faSchema = z.object({
  desafio: z.string().min(10),
  /** 6 dígitos do app ou código de recuperação XXXX-XXXX */
  codigo: z.string().trim().min(6).max(12),
});
export type Login2faDto = z.infer<typeof login2faSchema>;
