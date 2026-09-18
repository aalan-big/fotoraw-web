import { z } from 'zod';
import { emailSchema, senhaSchema } from './comum.js';
import { tokenSchema } from './verificar-email.dto.js';

export const recuperarSenhaSchema = z.object({ email: emailSchema });
export type RecuperarSenhaDto = z.infer<typeof recuperarSenhaSchema>;

export const redefinirSenhaSchema = z.object({ token: tokenSchema, senha: senhaSchema });
export type RedefinirSenhaDto = z.infer<typeof redefinirSenhaSchema>;
