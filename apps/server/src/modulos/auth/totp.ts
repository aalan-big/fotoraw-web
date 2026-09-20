import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';

/**
 * 2FA por app autenticador (TOTP, RFC 6238): 6 dígitos, 30 s, janela de ±1 passo.
 * O segredo fica cifrado no banco (AES-256-GCM com chave derivada do JWT_SECRET)
 * — vazou o banco, não vazou o 2FA. Códigos de recuperação: 8 de `XXXX-XXXX`,
 * guardados como sha256, cada um vale uma vez.
 */
const EMISSOR = 'FotoRAW Admin';

export function gerarSegredoTotp(): string {
  return new Secret({ size: 20 }).base32;
}

export function urlOtpauth(segredo: string, rotulo: string): string {
  return new TOTP({
    issuer: EMISSOR,
    label: rotulo,
    secret: Secret.fromBase32(segredo),
  }).toString();
}

export function validarCodigoTotp(segredo: string, codigo: string): boolean {
  const limpo = codigo.replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpo)) return false;
  const totp = new TOTP({ issuer: EMISSOR, secret: Secret.fromBase32(segredo) });
  return totp.validate({ token: limpo, window: 1 }) !== null;
}

// ---- cifra do segredo -----------------------------------------------------------

function chaveDe(segredoServidor: string): Buffer {
  return createHash('sha256').update(`totp:${segredoServidor}`).digest();
}

export function cifrarSegredo(segredo: string, segredoServidor: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chaveDe(segredoServidor), iv);
  const dados = Buffer.concat([cipher.update(segredo, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, dados].map((b) => b.toString('base64url')).join('.');
}

export function decifrarSegredo(cifrado: string, segredoServidor: string): string {
  const [iv, tag, dados] = cifrado.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', chaveDe(segredoServidor), iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(dados!), decipher.final()]).toString('utf8');
}

// ---- códigos de recuperação ----------------------------------------------------

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

export function gerarCodigosRecuperacao(quantos = 8): string[] {
  return Array.from({ length: quantos }, () => {
    const bytes = randomBytes(8);
    const letras = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join('');
    return `${letras.slice(0, 4)}-${letras.slice(4)}`;
  });
}

export function hashCodigoRecuperacao(codigo: string): string {
  return createHash('sha256')
    .update(codigo.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .digest('hex');
}

export function pareceCodigoRecuperacao(codigo: string): boolean {
  return /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(codigo.trim());
}
