import { z } from 'zod';
import { paginacaoSchema } from './contas.dto.js';

/** Período em dias de calendário (YYYY-MM-DD); padrão = mês atual. */
export const periodoSchema = z
  .object({
    de: z.coerce.date().optional(),
    ate: z.coerce.date().optional(),
  })
  .refine((p) => !p.de || !p.ate || p.de <= p.ate, { message: 'Período invertido', path: ['ate'] });
export type PeriodoDto = z.infer<typeof periodoSchema>;

export const listarRepassesSchema = paginacaoSchema.extend({
  status: z.enum(['ABERTO', 'SOLICITADO', 'PAGO', 'FALHOU']).optional(),
  contaId: z.uuid().optional(),
});
export type ListarRepassesDto = z.infer<typeof listarRepassesSchema>;

/** Gera um repasse Pix manual com o saldo em aberto da conta (ou um valor menor). */
export const gerarRepasseSchema = z.object({
  contaId: z.uuid(),
  /** parcial; omitido = saldo inteiro */
  valorCentavos: z.number().int().positive().optional(),
});
export type GerarRepasseDto = z.infer<typeof gerarRepasseSchema>;

export const pagarRepasseSchema = z.object({
  pagoEm: z.coerce.date().optional(),
  /** id da transação Pix / E2E, ou referência do comprovante */
  referencia: z.string().trim().max(120).optional(),
});
export type PagarRepasseDto = z.infer<typeof pagarRepasseSchema>;

export const falhaRepasseSchema = z.object({
  motivo: z.string().trim().min(3).max(300),
});
export type FalhaRepasseDto = z.infer<typeof falhaRepasseSchema>;
