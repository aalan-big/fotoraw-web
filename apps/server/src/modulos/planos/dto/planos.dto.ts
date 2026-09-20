import { z } from 'zod';

export const assinarPlanoSchema = z.object({
  planoCodigo: z.enum(['pro_mensal', 'pro_anual'], {
    error: 'Plano inválido. Escolha pro_mensal ou pro_anual.',
  }),
});

export type AssinarPlanoDto = z.infer<typeof assinarPlanoSchema>;

export const cancelarAssinaturaSchema = z.object({
  motivo: z.string().trim().max(500).optional(),
});

export type CancelarAssinaturaDto = z.infer<typeof cancelarAssinaturaSchema>;
