import { gerarTokenOpaco, hashToken } from './tokens.js';

describe('tokens', () => {
  it('token opaco tem 256 bits em base64url e é único', () => {
    const a = gerarTokenOpaco();
    const b = gerarTokenOpaco();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('hash é determinístico e não é o token', () => {
    const t = gerarTokenOpaco();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).not.toContain(t);
  });
});
