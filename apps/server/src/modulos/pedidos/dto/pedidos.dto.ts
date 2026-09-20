import { z } from 'zod';

export const statusPedidoEnum = z.enum([
  'ABERTO',
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'CANCELADO',
  'EXPIRADO',
  'ESTORNADO',
]);

export const listarPedidosSchema = z.object({
  status: statusPedidoEnum.optional(),
  galeriaId: z.uuid().optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarPedidosDto = z.infer<typeof listarPedidosSchema>;

export const exportarCsvSchema = z.object({
  status: statusPedidoEnum.optional(),
  galeriaId: z.uuid().optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
});
export type ExportarCsvDto = z.infer<typeof exportarCsvSchema>;
