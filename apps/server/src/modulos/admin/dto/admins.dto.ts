import { z } from 'zod';
import { emailSchema, senhaSchema } from '../../auth/dto/comum.js';

const codigoSchema = z.string().trim().min(6).max(12);

export const confirmar2faSchema = z.object({ codigo: codigoSchema });
export type Confirmar2faDto = z.infer<typeof confirmar2faSchema>;

export const desativar2faSchema = z.object({
  senha: z.string().min(1).max(128),
  codigo: codigoSchema,
});
export type Desativar2faDto = z.infer<typeof desativar2faSchema>;

/** Outro admin nasce por aqui (ou pelo script). Senha inicial definida pelo dono. */
export const criarAdminSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  email: emailSchema,
  senha: senhaSchema,
});
export type CriarAdminDto = z.infer<typeof criarAdminSchema>;

export const statusAdminSchema = z.object({
  status: z.enum(['ATIVA', 'BLOQUEADA']),
  motivo: z.string().trim().min(3).max(300),
});
export type StatusAdminDto = z.infer<typeof statusAdminSchema>;
