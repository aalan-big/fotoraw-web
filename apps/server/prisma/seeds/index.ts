// Seed de desenvolvimento: `npm run db:seed`.
// Duas contas, eventos públicos e ensaios em portfólio, pra vitrine ter cara de vitrine.
// As capas vêm do picsum.photos — só pra dev, nunca em produção.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';
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

/** Senha de todas as contas do seed (só dev): `fotoraw-dev-2026` */
const SENHA_SEED = 'fotoraw-dev-2026';

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const capa = (semente: string) => `https://picsum.photos/seed/${semente}/1200/1600`;

const contas = [
  {
    nome: 'Estúdio Luz',
    slug: 'estudio-luz',
    email: 'contato@estudioluz.local',
    cidade: 'Curitiba',
    uf: 'PR',
  },
  {
    nome: 'Marcos Foco',
    slug: 'marcosfoco',
    email: 'marcos@foco.local',
    cidade: 'Fortaleza',
    uf: 'CE',
  },
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
  precoFotoCentavos: number | null;
  publicadaEm: Date;
  capaKey: string | null;
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
  precoFotoCentavos: null,
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
    precoFotoCentavos: 1500,
    publicadaEm: diasAtras(1),
    capaKey: capa('maratona'),
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
    precoFotoCentavos: 1200,
    publicadaEm: diasAtras(3),
    capaKey: capa('pedal'),
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
    precoFotoCentavos: 1800,
    publicadaEm: diasAtras(5),
    capaKey: capa('noturna'),
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
    precoFotoCentavos: 2000,
    publicadaEm: diasAtras(9),
    capaKey: null,
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
    capaKey: capa('gestante'),
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
    capaKey: capa('casamento'),
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
    capaKey: capa('newborn'),
    fotos: 18,
  }),
] as SeedGaleria[];

async function main() {
  const idPorSlug = new Map<string, string>();
  const senhaHash = await hash(SENHA_SEED, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  for (const { cidade, uf, ...c } of contas) {
    const conta = await prisma.conta.upsert({
      where: { slug: c.slug },
      update: { nome: c.nome, senhaHash, emailVerificadoEm: new Date() },
      create: {
        ...c,
        senhaHash,
        emailVerificadoEm: new Date(),
        perfil: { create: { nomeFantasia: c.nome, cidade, uf } },
      },
    });
    idPorSlug.set(c.slug, conta.id);
  }

  // vendas de exemplo são recriadas do zero (itens apontam pra fotos, que são recriadas abaixo)
  await prisma.pedido.deleteMany({ where: { contaId: { in: [...idPorSlug.values()] } } });
  await prisma.repasse.deleteMany({ where: { contaId: { in: [...idPorSlug.values()] } } });

  for (const g of galerias) {
    const contaId = idPorSlug.get(g.conta)!;
    const { conta: _, fotos, ...dados } = g;
    const galeria = await prisma.galeria.upsert({
      where: { contaId_ensaioIdDesktop: { contaId, ensaioIdDesktop: g.ensaioIdDesktop } },
      update: { ...dados, contaId, totalFotos: fotos },
      create: { ...dados, contaId, status: 'PUBLICADA', totalFotos: fotos },
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

  const vendas = await semearVendas(idPorSlug);
  console.log(`seed ok: ${contas.length} contas, ${galerias.length} galerias, ${vendas} pedidos`);
}

/**
 * Vendas de foto de evento nos últimos 45 dias, pra Financeiro/360 terem números.
 * Comissão 10% (regra do gratuito) e taxa do provedor ~1%; tudo já pago.
 */
async function semearVendas(idPorSlug: Map<string, string>): Promise<number> {
  const compradores = [
    ['ana.souza@exemplo.local', 'Ana Souza'],
    ['bruno.lima@exemplo.local', 'Bruno Lima'],
    ['carla.mendes@exemplo.local', 'Carla Mendes'],
    ['diego.rocha@exemplo.local', 'Diego Rocha'],
    ['elisa.costa@exemplo.local', 'Elisa Costa'],
  ] as const;
  const ids: string[] = [];
  for (const [email, nome] of compradores) {
    const c = await prisma.comprador.upsert({
      where: { email },
      update: { nome },
      create: { email, nome, aceitouTermosEm: diasAtras(60) },
    });
    ids.push(c.id);
  }

  const eventos = await prisma.galeria.findMany({
    where: {
      contaId: { in: [...idPorSlug.values()] },
      modalidade: 'EVENTO',
      totalFotos: { gt: 0 },
    },
    include: { fotos: { take: 6, orderBy: { ordem: 'asc' } } },
  });
  let total = 0;
  let n = 0;
  for (const g of eventos) {
    // 4 a 6 pedidos por galeria, espalhados nos últimos 45 dias, 1 a 3 fotos cada
    const quantos = 4 + (g.slug.length % 3);
    for (let i = 0; i < quantos; i++) {
      n += 1;
      const fotos = g.fotos.slice(i % 3, (i % 3) + 1 + ((i + n) % 3));
      if (!fotos.length) continue;
      const preco = g.precoFotoCentavos ?? 1500;
      const subtotal = preco * fotos.length;
      const comissao = Math.round(subtotal * 0.1);
      const taxa = Math.round(subtotal * 0.01);
      const pagoEm = diasAtras(((i * 7 + n * 3) % 45) + 0.3);
      await prisma.pedido.create({
        data: {
          contaId: g.contaId,
          galeriaId: g.id,
          compradorId: ids[(i + n) % ids.length]!,
          status: 'PAGO',
          subtotalCentavos: subtotal,
          totalCentavos: subtotal,
          comissaoPct: 10,
          comissaoCentavos: comissao,
          taxaProvedorCentavos: taxa,
          repasseCentavos: subtotal - comissao - taxa,
          pagoEm,
          criadoEm: new Date(pagoEm.getTime() - 5 * 60 * 1000),
          itens: {
            create: fotos.map((f) => ({ fotoId: f.id, precoCentavos: preco })),
          },
          pagamentos: {
            create: {
              provedor: 'MERCADOPAGO',
              metodo: 'PIX',
              provedorPagamentoId: `seed-${g.slug}-${i}`,
              status: 'APROVADO',
              valorCentavos: subtotal,
              aprovadoEm: pagoEm,
            },
          },
        },
      });
      total += 1;
    }
  }
  return total;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
