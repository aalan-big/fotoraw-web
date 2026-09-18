import { z } from 'zod';
import { emailSchema } from './comum.js';

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1).max(128),
});

export type LoginDto = z.infer<typeof loginSchema>;
