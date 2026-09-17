import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';

/** Apaga todas as linhas de todas as tabelas (mantém schema). Use no beforeEach dos e2e. */
export async function limparBanco(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const tabelas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tabelas.length === 0) return;
  const lista = tabelas.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}
