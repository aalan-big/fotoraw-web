import { urlPublica } from './urls.js';

describe('urlPublica', () => {
  it('monta a URL a partir da chave', () => {
    expect(urlPublica('http://cdn/previews/', '/capas/a.jpg')).toBe(
      'http://cdn/previews/capas/a.jpg',
    );
  });
  it('deixa URL completa passar (seed de dev)', () => {
    expect(urlPublica('http://cdn', 'https://picsum.photos/x')).toBe('https://picsum.photos/x');
  });
  it('null quando não há chave', () => {
    expect(urlPublica('http://cdn', null)).toBeNull();
  });
});
