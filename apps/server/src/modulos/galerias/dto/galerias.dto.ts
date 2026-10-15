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

const centavos = z.number().int().min(100, { message: 'Mínimo de R$ 1,00' }).max(1_000_000);

/**
 * Mudar só os valores da galeria — sem reenviar fotos (painel ou "salvar só os
 * valores" no desktop). O modo de venda não muda aqui: isso é republicar.
 */
export const alterarPrecosSchema = z
  .object({
    /** avulso: preço de cada foto · pacote: preço da foto extra */
    precoFotoCentavos: centavos.nullable().optional(),
    /** pacote */
    fotosIncluidas: z.number().int().min(0).max(10_000).optional(),
    precoPacoteCentavos: centavos.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nada pra alterar' });
export type AlterarPrecosDto = z.infer<typeof alterarPrecosSchema>;
