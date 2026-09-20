import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Deriva uma chave de 32 bytes segura a partir da chave configurada no env.
 */
function obterChave32Bytes(segredo: string): Buffer {
  return createHash('sha256').update(segredo).digest();
}

/**
 * Criptografa um texto usando AES-256-GCM.
 * Retorna string no formato: `iv_hex:auth_tag_hex:ciphertext_hex`
 */
export function cifrar(texto: string, segredo: string): string {
  if (!texto) return '';
  const chave = obterChave32Bytes(segredo);
  const iv = randomBytes(12); // 96 bits recomendado para GCM

  const cipher = createCipheriv('aes-256-gcm', chave, iv);
  const bufferCifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${bufferCifrado.toString('hex')}`;
}

/**
 * Descriptografa um texto criptografado com AES-256-GCM.
 * Lança erro se o formato for inválido ou a auth tag não coincidir (dados adulterados).
 */
export function decifrar(textoCifrado: string, segredo: string): string {
  if (!textoCifrado) return '';
  const partes = textoCifrado.split(':');
  if (partes.length !== 3) {
    throw new Error('Formato de texto cifrado inválido para AES-256-GCM');
  }

  const [ivHex, tagHex, dataHex] = partes;
  const chave = obterChave32Bytes(segredo);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const dados = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', chave, iv);
  decipher.setAuthTag(tag);

  const bufferDecifrado = Buffer.concat([decipher.update(dados), decipher.final()]);
  return bufferDecifrado.toString('utf8');
}
