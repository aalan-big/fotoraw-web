import { z } from 'zod';

export const FOTOS_POR_PAGINA = 60;

/** GET /publico/galerias/:conta/:galeria — `codigo` só nas privadas (vem no link do WhatsApp). */
export const abrirGaleriaSchema = z.object({
  codigo: z.string().trim().max(20).optional(),
  /** número de peito / identificação: filtra as fotos */
  numero: z.string().trim().max(50).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});
export type AbrirGaleriaDto = z.infer<typeof abrirGaleriaSchema>;

/** POST /publico/acesso — quem tem só o código (página /ensaio). */
export const acessoPorCodigoSchema = z.object({
  codigo: z.string().trim().min(3).max(20),
  senha: z.string().max(100).optional(),
});
export type AcessoPorCodigoDto = z.infer<typeof acessoPorCodigoSchema>;
