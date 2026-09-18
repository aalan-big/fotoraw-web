import { z } from 'zod';
import { emailSchema } from './comum.js';

export const tokenSchema = z.string().trim().min(20).max(128);

export const verificarEmailSchema = z.object({ token: tokenSchema });
export type VerificarEmailDto = z.infer<typeof verificarEmailSchema>;

export const reenviarVerificacaoSchema = z.object({ email: emailSchema });
export type ReenviarVerificacaoDto = z.infer<typeof reenviarVerificacaoSchema>;
