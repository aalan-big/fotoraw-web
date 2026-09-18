import { randomBytes } from 'node:crypto';

/** Sem 0/O/1/I pra não confundir quem digita. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** FR-XXXX-XXXX-XXXX — a chave que o fotógrafo pode ver no painel e colar no desktop. */
export function gerarChaveLicenca(): string {
  const bytes = randomBytes(12);
  const letras = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
  return `FR-${letras.slice(0, 4)}-${letras.slice(4, 8)}-${letras.slice(8, 12)}`;
}
