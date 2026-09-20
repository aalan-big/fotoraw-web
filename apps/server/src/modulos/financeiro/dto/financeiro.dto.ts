import { z } from 'zod';

export const atualizarTaxasSchema = z.object({
  taxasParaCliente: z.boolean().optional(),
  chavePix: z.string().trim().max(100).optional().nullable(),
  cnpjCpf: z.string().trim().max(20).optional().nullable(),
});
export type AtualizarTaxasDto = z.infer<typeof atualizarTaxasSchema>;

export const callbackMercadoPagoSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type CallbackMercadoPagoDto = z.infer<typeof callbackMercadoPagoSchema>;
