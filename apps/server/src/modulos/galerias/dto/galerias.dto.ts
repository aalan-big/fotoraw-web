import { z } from 'zod';

export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const listarGaleriasSchema = paginacaoSchema.extend({
  status: z.enum(['RASCUNHO', 'PUBLICADA', 'PAUSADA', 'ENCERRADA']).optional(),
  modalidade: z.enum(['EVENTO', 'ENSAIO_INTERNO', 'ENSAIO_EXTERNO']).optional(),
  q: z.string().trim().max(100).optional(),
});
export type ListarGaleriasDto = z.infer<typeof listarGaleriasSchema>;

export const alterarStatusGaleriaSchema = z.object({
  status: z.enum(['PUBLICADA', 'PAUSADA', 'ENCERRADA']),
});
export type AlterarStatusGaleriaDto = z.infer<typeof alterarStatusGaleriaSchema>;
