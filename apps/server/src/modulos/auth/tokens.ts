import { createHash, randomBytes, randomUUID } from 'node:crypto';

/** Token opaco de 256 bits, base64url (43 chars). Vai em claro pro cliente uma vez. */
export function gerarTokenOpaco(): string {
  return randomBytes(32).toString('base64url');
}

/** O banco guarda só isto. Sem sal: o token já tem 256 bits de entropia. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function novaFamilia(): string {
  return randomUUID();
}

export function daquiA(ms: number): Date {
  return new Date(Date.now() + ms);
}

export const DIA_MS = 24 * 60 * 60 * 1000;
export const HORA_MS = 60 * 60 * 1000;
export const MINUTO_MS = 60 * 1000;
