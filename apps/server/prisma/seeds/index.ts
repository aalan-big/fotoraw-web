// Seed de desenvolvimento: `npm run db:seed`.
// Duas contas, eventos públicos e ensaios em portfólio, pra vitrine ter cara de vitrine.
// As capas vêm do picsum.photos — só pra dev, nunca em produção.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type Categoria,
  type Modalidade,
  type ModoVenda,
  PrismaClient,
  type Visibilidade,
} from '../../src/infra/prisma/gerado/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const capa = (semente: string) => `https://picsum.photos/seed/${semente}/1200/1600`;

const contas = [
  { nome: 'Estúdio Luz', slug: 'estudio-luz', email: 'contato@estudioluz.local' },
  { nome: 'Marcos Foco', slug: 'marcosfoco', email: 'marcos@foco.local' },
];

interface SeedGaleria {
  conta: string;
  ensaioIdDesktop: string;
  titulo: string;
  slug: string;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  modoVenda: ModoVenda;
  categoria: Categoria;
  dataEvento: Date;
  cidade: string;
  uf: string;
  precoFoto: string | null;
  publicadaEm: Date;
  capaUrl: string | null;
  fotos: number;
}

const evento = (g: Partial<SeedGaleria>): Partial<SeedGaleria> => ({
  modalidade: 'EVENTO',
  visibilidade: 'PUBLICA',
  modoVenda: 'AVULSO',
  ...g,
});
const portfolio = (g: Partial<SeedGaleria>): Partial<SeedGaleria> => ({
  visibilidade: 'PORTFOLIO',
  modoVenda: 'PACOTE',
  precoFoto: null,
  ...g,
});

const galerias = [
  evento({
    conta: 'estudio-luz',
    ensaioIdDesktop: 'ensaio-demo-1',
    titulo: 'Maratona de Curitiba 2026',
    slug: 'maratona-curitiba-2026',
    categoria: 'CORRIDA_RUA',
    dataEvento: diasAtras(2),
    cidade: 'Curitiba',
    uf: 'PR',
    precoFoto: '15.00',
    publicadaEm: diasAtras(1),
    capaUrl: capa('maratona'),
    fotos: 48,
  }),
  evento({
    conta: 'estudio-luz',
    ensaioIdDesktop: 'ensaio-demo-2',
    titulo: 'Pedal Serra do Mar',
    slug: 'pedal-serra-do-mar',
    categoria: 'CICLISMO',
    dataEvento: diasAtras(4),
    cidade: 'Morretes',
    uf: 'PR',
    precoFoto: '12.00',
    publicadaEm: diasAtras(3),
    capaUrl: capa('pedal'),
    fotos: 120,
  }),
  evento({
    conta: 'marcosfoco',
    ensaioIdDesktop: 'ensaio-demo-3',
    titulo: 'Corrida Noturna 10K',
    slug: 'corrida-noturna-10k',
    categoria: 'CORRIDA_RUA',
    dataEvento: diasAtras(6),
    cidade: 'Iguatu',
    uf: 'CE',
    precoFoto: '18.00',
    publicadaEm: diasAtras(5),
    capaUrl: capa('noturna'),
    fotos: 75,
  }),
  evento({
    conta: 'marcosfoco',
    ensaioIdDesktop: 'ensaio-demo-4',
    titulo: 'Formatura Medicina UFPR',
    slug: 'formatura-medicina-ufpr',
    categoria: 'FORMATURA',
    dataEvento: diasAtras(10),
    cidade: 'Curitiba',
    uf: 'PR',
    precoFoto: '20.00',
    publicadaEm: diasAtras(9),
    capaUrl: null,
    fotos: 0,
  }),
  // ensaios que o cliente autorizou mostrar: aparecem em "Ensaios em destaque"
  portfolio({
    conta: 'estudio-luz',
    ensaioIdDesktop: 'ensaio-demo-5',
    titulo: 'Ensaio gestante — Ana & Pedro',
    slug: 'ensaio-gestante-ana-pedro',
    modalidade: 'ENSAIO_EXTERNO',
    categoria: 'GESTANTE',
    dataEvento: diasAtras(20),
    cidade: 'Curitiba',
    uf: 'PR',
    publicadaEm: diasAtras(12),
    capaUrl: capa('gestante'),
    fotos: 24,
  }),
  portfolio({
    conta: 'marcosfoco',
    ensaioIdDesktop: 'ensaio-demo-6',
    titulo: 'Casamento Júlia & Rafael',
    slug: 'casamento-julia-rafael',
    modalidade: 'ENSAIO_EXTERNO',
    modoVenda: 'ENTREGA',
    categoria: 'CASAMENTO',
    dataEvento: diasAtras(30),
    cidade: 'Fortaleza',
    uf: 'CE',
    publicadaEm: diasAtras(15),
    capaUrl: capa('casamento'),
    fotos: 60,
  }),
  portfolio({
    conta: 'marcosfoco',
    ensaioIdDesktop: 'ensaio-demo-7',
    titulo: 'Newborn — Helena',
    slug: 'newborn-helena',
    modalidade: 'ENSAIO_INTERNO',
    categoria: 'NEWBORN',
    dataEvento: diasAtras(40),
    cidade: 'Fortaleza',
    uf: 'CE',
    publicadaEm: diasAtras(18),
    capaUrl: capa('newborn'),
    fotos: 18,
  }),
] as SeedGaleria[];

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
      create: { ...dados, contaId, status: 'PUBLICADA' },
    });

    // fotos numeradas: número de peito 1000..., 3 fotos por atleta (irrelevante em ensaio)
    await prisma.foto.deleteMany({ where: { galeriaId: galeria.id } });
    if (fotos > 0) {
      await prisma.foto.createMany({
        data: Array.from({ length: fotos }, (_, i) => ({
          galeriaId: galeria.id,
          fotoIdDesktop: `${g.ensaioIdDesktop}-foto-${i + 1}`,
          previewKey: `previews/${g.slug}/${i + 1}.jpg`,
          altaKey: `originais/${g.slug}/${i + 1}.jpg`,
          numeroIdentificacao: g.modalidade === 'EVENTO' ? String(1000 + Math.floor(i / 3)) : null,
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
