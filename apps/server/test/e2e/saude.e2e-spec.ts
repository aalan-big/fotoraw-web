import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarApp } from '../utils/criar-app.js';

describe('GET /api/saude (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde ok com banco conectado', async () => {
    const res = await request(app.getHttpServer()).get('/api/saude').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', banco: 'ok' });
  });

  it('rota inexistente cai no filtro padrão de erro', async () => {
    const res = await request(app.getHttpServer()).get('/api/nao-existe').expect(404);
    expect(res.body).toMatchObject({
      status: 404,
      codigo: 'ERRO_HTTP',
      caminho: '/api/nao-existe',
    });
  });
});
