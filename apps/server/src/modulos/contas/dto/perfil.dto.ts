import { z } from 'zod';

const opcional = (max: number) => z.string().trim().max(max).nullable().optional();
const soDigitos = (v: string | null | undefined) => (v ? v.replace(/\D/g, '') : v);

/** Perfil público (`/@slug`) + dados fiscais/Pix do Financeiro. Logo e capa entram com o storage. */
export const perfilSchema = z.object({
  nomeFantasia: z.string().trim().min(2).max(80).optional(),
  bio: opcional(600),
  whatsapp: z
    .string()
    .trim()
    .transform(soDigitos)
    .pipe(z.string().regex(/^\d{10,13}$/, 'WhatsApp com DDD, só números'))
    .nullable()
    .optional(),
  instagram: opcional(60).transform((v) => (v ? v.replace(/^@/, '') : v)),
  site: z.url().nullable().optional(),
  cidade: opcional(80),
  uf: z.string().trim().toUpperCase().length(2).nullable().optional(),
  cnpjCpf: z
    .string()
    .trim()
    .transform(soDigitos)
    .pipe(z.string().regex(/^(\d{11}|\d{14})$/, 'CPF (11 dígitos) ou CNPJ (14 dígitos)'))
    .nullable()
    .optional(),
  chavePix: opcional(120),
  taxasParaCliente: z.boolean().optional(),
});

export type PerfilDto = z.infer<typeof perfilSchema>;
