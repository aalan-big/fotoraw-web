import { z } from 'zod';

const limite = z.number().int().min(0).nullable();

/**
 * Tudo opcional: o admin manda só o que mudou. `codigo` não se edita — o
 * seed, o desktop e o checkout apontam pra ele.
 */
export const editarPlanoSchema = z
  .object({
    nome: z.string().trim().min(2).max(60),
    precoCentavos: z.number().int().min(0),
    periodicidade: z.enum(['MENSAL', 'ANUAL', 'NENHUMA']),
    comissaoEventoPct: z.number().min(0).max(100),
    limiteGaleriasAtivas: limite,
    limiteFotosPorGaleria: limite,
    limiteArmazenamentoMb: limite,
    limiteDispositivos: limite,
    permiteEvento: z.boolean(),
    permiteEnsaio: z.boolean(),
    permiteGaleriaPrivada: z.boolean(),
    permiteGestaoEstudio: z.boolean(),
    ativo: z.boolean(),
    ordem: z.number().int().min(0).max(999),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada pra alterar' });
export type EditarPlanoDto = z.infer<typeof editarPlanoSchema>;

export const reemitirPlanoSchema = z.object({
  motivo: z.string().trim().min(3).max(300),
});
export type ReemitirPlanoDto = z.infer<typeof reemitirPlanoSchema>;
