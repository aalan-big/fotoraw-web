import { z } from 'zod';

const categorias = [
  'CORRIDA_RUA',
  'TRAIL',
  'CICLISMO',
  'TRIATLO',
  'NATACAO',
  'ESPORTIVO',
  'FORMATURA',
  'CASAMENTO',
  'FESTA',
  'CORPORATIVO',
  'GESTANTE',
  'NEWBORN',
  'FAMILIA',
  'INFANTIL',
  'QUINZE_ANOS',
  'CASAL',
  'PESSOAL',
  'MODA',
  'PRODUTO',
  'OUTRO',
] as const;

export const fotoSyncItemSchema = z.object({
  fotoIdDesktop: z.string().min(1),
  largura: z.number().int().positive().optional(),
  altura: z.number().int().positive().optional(),
  tamanhoAltaBytes: z.number().int().positive().optional(),
  numeroIdentificacao: z.string().trim().max(50).optional(),
  precoCentavos: z.number().int().min(0).optional(),
  ordem: z.number().int().min(0).default(0),
  temAlta: z.boolean().default(true),
});
export type FotoSyncItemDto = z.infer<typeof fotoSyncItemSchema>;

export const iniciarSyncLoteSchema = z.object({
  chaveIdempotencia: z.string().min(1).max(128),
  ensaioIdDesktop: z.string().min(1),
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1000).optional(),
  slug: z.string().trim().max(200).optional(),
  modalidade: z.enum(['EVENTO', 'ENSAIO_INTERNO', 'ENSAIO_EXTERNO']),
  visibilidade: z.enum(['PUBLICA', 'PRIVADA', 'PORTFOLIO']).optional(),
  categoria: z.enum(categorias).default('OUTRO'),
  modoVenda: z.enum(['AVULSO', 'PACOTE', 'ENTREGA']),
  precoFotoCentavos: z.number().int().min(0).optional(),
  fotosIncluidas: z.number().int().min(0).optional(),
  precoPacoteCentavos: z.number().int().min(0).optional(),
  permiteDownloadGratis: z.boolean().default(false),
  codigoAcesso: z.string().trim().max(20).optional(),
  senha: z.string().min(4).max(100).optional(),
  dataEvento: z.coerce.date().optional(),
  cidade: z.string().trim().max(100).optional(),
  uf: z.string().trim().length(2).optional(),
  encerraEm: z.coerce.date().optional(),
  fotos: z.array(fotoSyncItemSchema).min(1),
});
export type IniciarSyncLoteDto = z.infer<typeof iniciarSyncLoteSchema>;

export const confirmarFotoItemSchema = z.object({
  fotoIdDesktop: z.string().min(1),
  previewKey: z.string().min(1),
  altaKey: z.string().optional(),
  largura: z.number().int().positive().optional(),
  altura: z.number().int().positive().optional(),
  tamanhoAltaBytes: z.number().int().positive().optional(),
});

export const confirmarSyncLoteSchema = z.object({
  fotos: z.array(confirmarFotoItemSchema).min(1),
  capaKey: z.string().optional(),
});
export type ConfirmarSyncLoteDto = z.infer<typeof confirmarSyncLoteSchema>;
