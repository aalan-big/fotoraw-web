import { SenhaService } from './senha.service.js';
import { ehSenhaComum } from './senhas-comuns.js';

describe('SenhaService', () => {
  const senha = new SenhaService();

  it('gera argon2id com os parâmetros combinados e confere', async () => {
    const hash = await senha.hash('correta-123');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
    expect(await senha.conferir(hash, 'correta-123')).toBe(true);
    expect(await senha.conferir(hash, 'errada-123')).toBe(false);
  });

  it('hash malformado no banco conta como senha errada, sem lançar', async () => {
    expect(await senha.conferir('trocar-por-hash-real', 'qualquer')).toBe(false);
  });
});

describe('ehSenhaComum', () => {
  it('pega variações de caixa e espaços', () => {
    expect(ehSenhaComum('Senha123')).toBe(true);
    expect(ehSenhaComum('PASS WORD')).toBe(true);
    expect(ehSenhaComum('minha-frase-longa-2026')).toBe(false);
  });
});
