import { z } from 'zod';

/** Excluir pede a senha de novo — sessão roubada não apaga a conta. */
export const excluirContaSchema = z.object({ senha: z.string().min(1).max(128) });

export type ExcluirContaDto = z.infer<typeof excluirContaSchema>;
