import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seeds/index.ts',
  },
  datasource: {
    // Migrations precisam de conexão direta (Supabase: porta 5432, sem pooler).
    // Em runtime a app usa DATABASE_URL (pooler) via PrismaService.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
