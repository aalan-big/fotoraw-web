import { z } from 'zod';
import { paginacaoSchema } from './contas.dto.js';

export const listarLicencasSchema = paginacaoSchema.extend({
  tipo: z.enum(['ASSINATURA', 'CORTESIA', 'VITALICIA', 'TRIAL']).optional(),
  status: z.enum(['ATIVA', 'SUSPENSA', 'REVOGADA', 'EXPIRADA']).optional(),
  /** só as que vencem nos próximos N dias */
  venceEmDias: z.coerce.number().int().min(1).max(365).optional(),
});
export type ListarLicencasDto = z.infer<typeof listarLicencasSchema>;

const recursosParciaisSchema = z
  .object({
    limite_galerias_ativas: z.number().int().min(0).nullable(),
    limite_fotos_por_galeria: z.number().int().min(0).nullable(),
    limite_armazenamento_mb: z.number().int().min(0).nullable(),
    limite_dispositivos: z.number().int().min(0).nullable(),
    permite_evento: z.boolean(),
    permite_ensaio: z.boolean(),
    permite_galeria_privada: z.boolean(),
    permite_gestao_estudio: z.boolean(),
  })
  .partial();

export const emitirLicencaSchema = z
  .object({
    contaId: z.uuid(),
    tipo: z.enum(['CORTESIA', 'VITALICIA', 'TRIAL']),
    /** de onde vêm os limites; `recursos` ajusta por cima */
    planoBaseId: z.uuid(),
    recursos: recursosParciaisSchema.optional(),
    validaAte: z.coerce.date().optional(),
    motivo: z.string().trim().min(3).max(300),
  })
  .refine((d) => d.tipo === 'VITALICIA' || d.validaAte !== undefined, {
    message: 'Informe a validade (só vitalícia não vence)',
    path: ['validaAte'],
  })
  .refine((d) => !d.validaAte || d.validaAte.getTime() > Date.now(), {
    message: 'A validade precisa ser no futuro',
    path: ['validaAte'],
  });
export type EmitirLicencaDto = z.infer<typeof emitirLicencaSchema>;

export const alterarStatusLicencaSchema = z.object({
  status: z.enum(['ATIVA', 'SUSPENSA', 'REVOGADA']),
  motivo: z.string().trim().min(3).max(300),
});
export type AlterarStatusLicencaDto = z.infer<typeof alterarStatusLicencaSchema>;
