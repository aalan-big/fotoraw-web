import { z } from 'zod';

/** CPF com dígitos verificadores (o Pix do MP exige o documento do pagador). */
export function cpfValido(valor: string): boolean {
  const d = valor.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(cpfValido, { message: 'CPF inválido' });

/** POST /publico/pedidos — o carrinho vira pedido. Preço e comissão o server recalcula. */
export const criarPedidoSchema = z.object({
  galeriaId: z.uuid(),
  fotoIds: z
    .array(z.uuid())
    .min(1, { message: 'Escolha pelo menos uma foto' })
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Foto repetida no pedido' }),
  /** galeria privada: o mesmo código que abriu a galeria */
  codigo: z.string().trim().max(20).optional(),
  comprador: z.object({
    nome: z.string().trim().min(3, { message: 'Informe seu nome completo' }).max(120),
    email: z.email({ message: 'E-mail inválido' }).trim().toLowerCase(),
    whatsapp: z
      .string()
      .transform((v) => v.replace(/\D/g, ''))
      .refine((v) => v === '' || (v.length >= 10 && v.length <= 13), { message: 'WhatsApp inválido' })
      .optional(),
    cpf: cpfSchema,
  }),
  aceitouTermos: z.literal(true, { message: 'É preciso aceitar os termos' }),
});
export type CriarPedidoDto = z.infer<typeof criarPedidoSchema>;

/** POST /publico/pedidos/:id/cartao — token gerado pelo Brick no navegador (com a public_key do fotógrafo). */
export const pagarCartaoSchema = z.object({
  token: z.string().min(10).max(200),
  paymentMethodId: z.string().min(2).max(40),
  issuerId: z.union([z.string(), z.number()]).optional(),
  parcelas: z.number().int().min(1).max(12).default(1),
  email: z.email().trim().toLowerCase(),
  cpf: cpfSchema,
});
export type PagarCartaoDto = z.infer<typeof pagarCartaoSchema>;
