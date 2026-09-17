import { validarEnv } from './env.js';

const envValida = {
  WEB_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://x:y@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'segredo-com-mais-de-16-chars',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_ACCESS_KEY: 'a',
  STORAGE_SECRET_KEY: 'b',
  STORAGE_BUCKET_PREVIEWS: 'previews',
  STORAGE_BUCKET_ORIGINAIS: 'originais',
  STORAGE_PREVIEWS_URL_PUBLICA: 'http://localhost:9000/previews',
  EMAIL_REMETENTE: 'FotoRAW <x@y.z>',
};

describe('validarEnv', () => {
  it('aplica defaults quando o campo é opcional', () => {
    const env = validarEnv(envValida);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.COMISSAO_PLATAFORMA).toBe(0.1);
  });

  it('converte PORT e COMISSAO_PLATAFORMA de string para número', () => {
    const env = validarEnv({ ...envValida, PORT: '4000', COMISSAO_PLATAFORMA: '0.15' });
    expect(env.PORT).toBe(4000);
    expect(env.COMISSAO_PLATAFORMA).toBe(0.15);
  });

  it('lança listando os campos inválidos', () => {
    const { DATABASE_URL: _, ...semBanco } = envValida;
    expect(() => validarEnv({ ...semBanco, JWT_SECRET: 'curto' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET/,
    );
  });
});
