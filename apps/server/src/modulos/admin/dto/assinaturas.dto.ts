import { z } from 'zod';
import { paginacaoSchema } from './contas.dto.js';

export const listarAssinaturasSchema = paginacaoSchema.extend({
  status: z.enum(['TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA', 'EXPIRADA']).optional(),
  /** nome, e-mail ou @slug do fotógrafo */
  q: z.string().trim().max(80).optional(),
  /** só com fatura vencida em aberto */
  vencidas: z.coerce.boolean().optional(),
});
export type ListarAssinaturasDto = z.infer<typeof listarAssinaturasSchema>;

/**
 * Assinatura manual (Pix/transferência fora do sistema). A 1ª fatura nasce
 * junto; `jaPaga` marca ela paga na hora e já emite a licença.
 */
export const criarAssinaturaSchema = z.object({
  contaId: z.uuid(),
  planoId: z.uuid(),
  /** início do 1º período; padrão hoje */
  inicioEm: z.coerce.date().optional(),
  jaPaga: z.boolean().default(false),
  observacao: z.string().trim().max(500).optional(),
});
export type CriarAssinaturaDto = z.infer<typeof criarAssinaturaSchema>;

export const marcarFaturaPagaSchema = z.object({
  /** quando o dinheiro entrou; padrão agora */
  pagaEm: z.coerce.date().optional(),
  observacao: z.string().trim().max(300).optional(),
});
export type MarcarFaturaPagaDto = z.infer<typeof marcarFaturaPagaSchema>;

export const cancelarAssinaturaSchema = z.object({
  /** true = continua até `periodo_atual_fim`; false = derruba a licença agora */
  noFimDoPeriodo: z.boolean().default(true),
  motivo: z.string().trim().min(3).max(300),
});
export type CancelarAssinaturaDto = z.infer<typeof cancelarAssinaturaSchema>;

export const observacaoSchema = z.object({
  observacao: z.string().trim().max(500),
});
export type ObservacaoDto = z.infer<typeof observacaoSchema>;
