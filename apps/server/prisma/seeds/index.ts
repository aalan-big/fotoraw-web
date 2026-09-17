// Seed de desenvolvimento: `npm run db:seed`.
// Duas contas e alguns eventos com fotos, pra vitrine ter cara de vitrine.
// As capas/previews vêm do picsum.photos — só pra dev, nunca em produção.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/infra/prisma/gerado/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const capa = (semente: string) => `https://picsum.photos/seed/${semente}/1200/900`;

const contas = [
  { nome: 'Estúdio Luz', slug: 'estudio-luz', email: 'contato@estudioluz.local' },
  { nome: 'Marcos Foco', slug: 'marcosfoco', email: 'marcos@foco.local' },
];

const galerias = [
  {
    conta: 'estudio-luz',
    ensaioIdDesktop: 'ensaio-demo-1',
    titulo: 'Maratona de Curitiba 2026',
    slug: 'maratona-curitiba-2026',
    precoFoto: '15.00',
    publicadaEm: diasAtras(1),
    capaUrl: capa('maratona'),
    fotos: 48,
  },
  {
    conta: 'estudio-luz',
    ensaioIdDesktop: 'ensaio-demo-2',
    titulo: 'Pedal Serra do Mar',
    slug: 'pedal-serra-do-mar',
    precoFoto: '12.00',
    publicadaEm: diasAtras(3),
    capaUrl: capa('pedal'),
    fotos: 120,
  },
  {
    conta: 'marcosfoco',
    ensaioIdDesktop: 'ensaio-demo-3',
    titulo: 'Corrida Noturna 10K',
    slug: 'corrida-noturna-10k',
    precoFoto: '18.00',
    publicadaEm: diasAtras(5),
    capaUrl: capa('noturna'),
    fotos: 75,
  },
  {
    conta: 'marcosfoco',
    ensaioIdDesktop: 'ensaio-demo-4',
    titulo: 'Travessia da Lagoa',
    slug: 'travessia-da-lagoa',
    precoFoto: '20.00',
    publicadaEm: diasAtras(9),
    capaUrl: null,
    fotos: 0,
  },
];

async function main() {
  const idPorSlug = new Map<string, string>();
  for (const c of contas) {
    const conta = await prisma.conta.upsert({
      where: { slug: c.slug },
      update: { nome: c.nome },
      create: { ...c, senhaHash: 'trocar-por-hash-real' },
    });
    idPorSlug.set(c.slug, conta.id);
  }

  for (const g of galerias) {
    const contaId = idPorSlug.get(g.conta)!;
    const { conta: _, fotos, ...dados } = g;
    const galeria = await prisma.galeria.upsert({
      where: { contaId_ensaioIdDesktop: { contaId, ensaioIdDesktop: g.ensaioIdDesktop } },
      update: { ...dados, contaId },
      create: {
        ...dados,
        contaId,
        tipo: 'EVENTO',
        modoVenda: 'AVULSO',
        status: 'PUBLICADA',
      },
    });

    // fotos numeradas: número de peito 1000..1000+n, 3 fotos por atleta
    await prisma.foto.deleteMany({ where: { galeriaId: galeria.id } });
    if (fotos > 0) {
      await prisma.foto.createMany({
        data: Array.from({ length: fotos }, (_, i) => ({
          galeriaId: galeria.id,
          fotoIdDesktop: `${g.ensaioIdDesktop}-foto-${i + 1}`,
          previewKey: `previews/${g.slug}/${i + 1}.jpg`,
          altaKey: `originais/${g.slug}/${i + 1}.jpg`,
          numeroIdentificacao: String(1000 + Math.floor(i / 3)),
          largura: 1600,
          altura: 1067,
          ordem: i + 1,
        })),
      });
    }
  }

  console.log(`seed ok: ${contas.length} contas, ${galerias.length} galerias`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
