import { z } from 'zod';

/**
 * Contrato das variáveis de ambiente. Falha na subida se algo obrigatório
 * estiver faltando — melhor quebrar cedo do que descobrir num webhook.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).default(3001),
  WEB_URL: z.url(),

  DATABASE_URL: z.string().min(1),
  /** conexão direta p/ migrations (Supabase); opcional, cai em DATABASE_URL */
  DIRECT_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),

  STORAGE_ENDPOINT: z.url(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET_PREVIEWS: z.string().min(1),
  STORAGE_BUCKET_ORIGINAIS: z.string().min(1),
  STORAGE_PREVIEWS_URL_PUBLICA: z.url(),

  // Mercado Pago (vendas de evento, marketplace: fotógrafo conecta a conta dele)
  MERCADOPAGO_APP_ID: z.string().default(''),
  MERCADOPAGO_CLIENT_SECRET: z.string().default(''),
  MERCADOPAGO_ACCESS_TOKEN: z.string().default(''),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().default(''),
  // Stripe (assinatura de plano)
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  // chave (32 bytes base64) que cifra os tokens OAuth em conexoes_pagamento
  CHAVE_CIFRA_TOKENS: z.string().default(''),
  COMISSAO_PLATAFORMA: z.coerce.number().min(0).max(1).default(0.1),

  RESEND_API_KEY: z.string().default(''),
  EMAIL_REMETENTE: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/** Usado pelo ConfigModule (`validate`). Lança com a lista de campos inválidos. */
export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(config);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${problemas}`);
  }
  return resultado.data;
}
