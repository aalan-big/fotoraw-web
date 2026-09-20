import { z } from 'zod';
import { paginacaoSchema } from './contas.dto.js';

export const listarAuditoriaSchema = paginacaoSchema.extend({
  /** id da conta que fez (admin ou fotógrafo) */
  atorId: z.uuid().optional(),
  /** `sistema` = sem ator (cadastro, recuperar senha, webhooks) */
  ator: z.enum(['sistema', 'admin', 'fotografo']).optional(),
  /** ação exata, ou prefixo terminado em ponto (`licenca.`) */
  acao: z.string().trim().max(60).optional(),
  alvoTipo: z.string().trim().max(30).optional(),
  alvoId: z.string().trim().max(80).optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});
export type ListarAuditoriaDto = z.infer<typeof listarAuditoriaSchema>;

export const listarWebhooksSchema = paginacaoSchema.extend({
  provedor: z.enum(['MERCADOPAGO', 'STRIPE', 'MANUAL']).optional(),
  /** `erro` = com erro · `pendente` = ainda não processado · `ok` = processado sem erro */
  situacao: z.enum(['erro', 'pendente', 'ok']).optional(),
});
export type ListarWebhooksDto = z.infer<typeof listarWebhooksSchema>;

export const listarSyncSchema = paginacaoSchema.extend({
  status: z.enum(['RECEBIDO', 'PROCESSANDO', 'CONCLUIDO', 'ERRO']).optional(),
  contaId: z.uuid().optional(),
});
export type ListarSyncDto = z.infer<typeof listarSyncSchema>;
