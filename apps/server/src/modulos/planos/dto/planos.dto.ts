import { z } from 'zod';

export const assinarPlanoSchema = z.object({
  // os planos vêm do banco (admin edita); o service confere se existe, está ativo e é pago
  planoCodigo: z
    .string({ error: 'Escolha um plano.' })
    .trim()
    .regex(/^[a-z0-9_]{1,40}$/, 'Plano inválido.'),
  /** cartão tokenizado pelo Brick do MP no navegador (o número nunca chega aqui) */
  cartao: z
    .object({
      token: z.string().trim().min(8).max(200),
      email: z.email('E-mail inválido.').max(200),
    })
    .optional(),
});

export type AssinarPlanoDto = z.infer<typeof assinarPlanoSchema>;

export const cancelarAssinaturaSchema = z.object({
  motivo: z.string().trim().max(500).optional(),
});

export type CancelarAssinaturaDto = z.infer<typeof cancelarAssinaturaSchema>;
