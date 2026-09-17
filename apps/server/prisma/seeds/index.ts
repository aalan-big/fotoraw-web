// Seed de desenvolvimento: `pnpm db:seed`.
// Cria uma conta e uma galeria de evento para testar a vitrine localmente.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/infra/prisma/gerado/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const conta = await prisma.conta.upsert({
    where: { slug: 'estudio-luz' },
    update: {},
    create: {
      nome: 'Estúdio Luz',
      slug: 'estudio-luz',
      email: 'contato@estudioluz.local',
      senhaHash: 'trocar-por-hash-real',
    },
  });

  await prisma.galeria.upsert({
    where: { contaId_slug: { contaId: conta.id, slug: 'corrida-2026' } },
    update: {},
    create: {
      contaId: conta.id,
      ensaioIdDesktop: 'ensaio-demo-1',
      titulo: 'Corrida 2026',
      slug: 'corrida-2026',
      tipo: 'EVENTO',
      modoVenda: 'AVULSO',
      status: 'PUBLICADA',
      precoFoto: '15.00',
      publicadaEm: new Date(),
    },
  });

  console.log(`seed ok: conta ${conta.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
