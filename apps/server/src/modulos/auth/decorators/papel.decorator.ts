import { SetMetadata } from '@nestjs/common';
import type { PapelConta } from '../../../infra/prisma/gerado/client.js';

export const PAPEIS_CHAVE = 'papeis';

/** `@Papel('ADMIN')` — combinado com `PapelGuard`. */
export const Papel = (...papeis: PapelConta[]) => SetMetadata(PAPEIS_CHAVE, papeis);
