import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SaudeService } from './saude.service.js';

describe('SaudeService', () => {
  async function montar(queryRaw: () => Promise<unknown>) {
    const modulo = await Test.createTestingModule({
      providers: [SaudeService, { provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    return modulo.get(SaudeService);
  }

  it('responde ok quando o banco responde', async () => {
    const service = await montar(() => Promise.resolve([{ '?column?': 1 }]));
    await expect(service.verificar()).resolves.toMatchObject({ status: 'ok', banco: 'ok' });
  });

  it('responde degradado quando o banco falha', async () => {
    const service = await montar(() => Promise.reject(new Error('conexão recusada')));
    await expect(service.verificar()).resolves.toMatchObject({
      status: 'degradado',
      banco: 'erro',
    });
  });
});
