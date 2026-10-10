import { z } from 'zod';

export const assinarPlanoSchema = z.object({
  // os planos vêm do banco (admin edita); o service confere se existe, está ativo e é pago
  planoCodigo: z
    .string({ error: 'Escolha um plano.' })
    .trim()
    .regex(/^[a-z0-9_]{1,40}$/, 'Plano inválido.'),
});

export type AssinarPlanoDto = z.infer<typeof assinarPlanoSchema>;

export const cancelarAssinaturaSchema = z.object({
  motivo: z.string().trim().max(500).optional(),
});

export type CancelarAssinaturaDto = z.infer<typeof cancelarAssinaturaSchema>;
