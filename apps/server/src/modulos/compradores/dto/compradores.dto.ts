import { z } from 'zod';
import { cpfValido } from '../../pagamentos/vendas/dto/vendas.dto.js';

const email = z.email({ message: 'E-mail inválido' }).trim().toLowerCase();

export const pedirCodigoSchema = z.object({ email });
export type PedirCodigoDto = z.infer<typeof pedirCodigoSchema>;

export const confirmarCodigoSchema = z.object({
  email,
  codigo: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 6, { message: 'O código tem 6 dígitos' }),
});
export type ConfirmarCodigoDto = z.infer<typeof confirmarCodigoSchema>;

export const atualizarPerfilSchema = z.object({
  nome: z.string().trim().min(3).max(120).optional(),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || (v.length >= 10 && v.length <= 13), { message: 'WhatsApp inválido' })
    .optional(),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || cpfValido(v), { message: 'CPF inválido' })
    .optional(),
});
export type AtualizarPerfilDto = z.infer<typeof atualizarPerfilSchema>;
