import { z } from 'zod';

export const listarGaleriasSchema = z.object({
  /** filtro por título da galeria ou nome/slug do fotógrafo */
  q: z.string().trim().max(80).optional(),
  limite: z.coerce.number().int().min(1).max(48).default(12),
});

export type ListarGaleriasDto = z.infer<typeof listarGaleriasSchema>;
