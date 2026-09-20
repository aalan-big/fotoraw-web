import { describe, expect, it } from 'vitest';
import { cifrar, decifrar } from './cifra.js';

describe('cifra AES-256-GCM', () => {
  const segredo = 'minha-chave-secreta-de-teste-32-bytes!';
  const textoOriginal = 'APP_USR-9876543210-super-secret-token';

  it('cifra e decifra texto com sucesso', () => {
    const cifrado = cifrar(textoOriginal, segredo);
    expect(cifrado).not.toBe(textoOriginal);
    expect(cifrado.split(':')).toHaveLength(3);

    const decifrado = decifrar(cifrado, segredo);
    expect(decifrado).toBe(textoOriginal);
  });

  it('falha ao decifrar com chave diferente', () => {
    const cifrado = cifrar(textoOriginal, segredo);
    expect(() => decifrar(cifrado, 'chave-diferente-12345')).toThrow();
  });

  it('falha ao decifrar se o payload for adulterado', () => {
    const cifrado = cifrar(textoOriginal, segredo);
    const partes = cifrado.split(':');
    // altera o último caractere do dado cifrado
    const adulterado = `${partes[0]}:${partes[1]}:${partes[2].slice(0, -2)}ff`;
    expect(() => decifrar(adulterado, segredo)).toThrow();
  });
});
