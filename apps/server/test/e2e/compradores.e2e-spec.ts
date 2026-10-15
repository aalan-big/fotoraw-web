import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Email, EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Estúdio Luz',
  email: 'luz-compradores@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'estudio-luz',
};

describe('área do comprador "Minhas fotos" (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: Email[] = [];
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp((b) =>
      b.overrideProvider(EmailService).useValue({ enviar: async (e: Email) => void emails.push(e) }),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    emails.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  const codigoDoEmail = (para: string) => {
    const e = emails.filter((x) => x.para === para).at(-1);
    return /(\d{6})/.exec(e?.assunto ?? '')?.[1] ?? '';
  };

  async function entrar(email: string) {
    await api().post('/api/compradores/entrar/codigo').send({ email }).expect(200);
    const r = await api()
      .post('/api/compradores/entrar/confirmar')
      .send({ email, codigo: codigoDoEmail(email.toLowerCase()) })
      .expect(200);
    return r.body as { acesso: string; comprador: { id: string; email: string; nome: string } };
  }

  /** Simula uma compra já paga (o fluxo de pagamento tem o e2e dele). */
  async function compraPaga(compradorEmail: string, titulo: string, slug: string, fotos: number) {
    await prisma.plano.upsert({
      where: { codigo: 'gratuito' },
      create: { codigo: 'gratuito', nome: 'Gratuito', precoCentavos: 0, periodicidade: 'NENHUMA', comissaoEventoPct: 10, limiteDispositivos: 1, permiteEvento: true, ordem: 1 },
      update: {},
    });
    let conta = await prisma.conta.findFirst({ where: { slug: 'estudio-luz' } });
    if (!conta) {
      await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
      conta = await prisma.conta.findFirstOrThrow({ where: { slug: 'estudio-luz' } });
    }
    const galeria = await prisma.galeria.create({
      data: { contaId: conta.id, ensaioIdDesktop: slug, titulo, slug, modoVenda: 'AVULSO', precoFotoCentavos: 1500, status: 'PUBLICADA', capaKey: `previews/c/${slug}/capa.webp` },
    });
    const comprador = await prisma.comprador.upsert({
      where: { email: compradorEmail },
      create: { email: compradorEmail, nome: 'Maria da Silva', cpf: '52998224725', aceitouTermosEm: new Date() },
      update: {},
    });
    const ids: string[] = [];
    for (let i = 0; i < fotos; i++) {
      const f = await prisma.foto.create({
        data: { galeriaId: galeria.id, fotoIdDesktop: `f${i}`, previewKey: `previews/c/${slug}/f${i}.webp`, thumbKey: `previews/c/${slug}/f${i}.mini.webp`, altaKey: `originais/c/${slug}/f${i}.jpg`, numeroIdentificacao: String(100 + i) },
      });
      ids.push(f.id);
    }
    await prisma.pedido.create({
      data: {
        contaId: conta.id,
        galeriaId: galeria.id,
        compradorId: comprador.id,
        status: 'PAGO',
        pagoEm: new Date(),
        subtotalCentavos: 1500 * fotos,
        totalCentavos: 1500 * fotos,
        comissaoPct: 10,
        comissaoCentavos: 150 * fotos,
        repasseCentavos: 1350 * fotos,
        itens: { create: ids.map((fotoId) => ({ fotoId, precoCentavos: 1500 })) },
        downloads: {
          create: ids.map((fotoId, i) => ({ fotoId, compradorId: comprador.id, token: `tok-${slug}-${i}`, expiraEm: new Date('2100-01-01') })),
        },
      },
    });
    return galeria;
  }

  it('entra com código por e-mail e vê as compras feitas antes como visitante', async () => {
    await compraPaga('maria@exemplo.com', 'Corrida 10k', 'corrida-10k', 2);
    await compraPaga('maria@exemplo.com', 'Meia Maratona', 'meia', 1);
    await compraPaga('outra@exemplo.com', 'Corrida 10k (outra)', 'corrida-outra', 1);

    const { acesso, comprador } = await entrar('Maria@Exemplo.com');
    expect(comprador).toMatchObject({ email: 'maria@exemplo.com', nome: 'Maria da Silva' });

    const fotos = await api().get('/api/compradores/eu/fotos').set('Authorization', `Bearer ${acesso}`).expect(200);
    expect(fotos.body.map((g: { galeria: { titulo: string } }) => g.galeria.titulo).sort()).toEqual(['Corrida 10k', 'Meia Maratona']);
    const corrida = fotos.body.find((g: { galeria: { slug: string } }) => g.galeria.slug === 'corrida-10k');
    expect(corrida.galeria).toMatchObject({ contaSlug: 'estudio-luz', fotografo: 'Estúdio Luz' });
    expect(corrida.fotos).toHaveLength(2);
    expect(corrida.fotos[0].miniaturaUrl).toMatch(/\.mini\.webp$/);
    expect(corrida.fotos[0].token).toMatch(/^tok-corrida-10k-/);

    // o token do comprador baixa pelo mesmo link do pedido
    await api().get(`/api/publico/downloads/${corrida.fotos[0].token}`).expect(200);
  });

  it('código errado conta tentativa; código usado não vale de novo; sem token é 401', async () => {
    await api().post('/api/compradores/entrar/codigo').send({ email: 'joao@exemplo.com' }).expect(200);
    const certo = codigoDoEmail('joao@exemplo.com');
    const errado = certo === '000000' ? '111111' : '000000';
    const r = await api().post('/api/compradores/entrar/confirmar').send({ email: 'joao@exemplo.com', codigo: errado }).expect(401);
    expect(r.body.codigo).toBe('CODIGO_INVALIDO');

    const ok = await api().post('/api/compradores/entrar/confirmar').send({ email: 'joao@exemplo.com', codigo: certo }).expect(200);
    // entrou antes de comprar: nasce comprador sem aceite de termos (o checkout preenche)
    expect(ok.body.comprador).toMatchObject({ email: 'joao@exemplo.com', nome: 'joao' });
    await api().post('/api/compradores/entrar/confirmar').send({ email: 'joao@exemplo.com', codigo: certo }).expect(401);

    await api().get('/api/compradores/eu').expect(401);
    await api().get('/api/compradores/eu').set('Authorization', 'Bearer token-falso').expect(401);
  });

  it('5 tentativas erradas queimam o código; muitos pedidos de código seguidos são barrados', async () => {
    await api().post('/api/compradores/entrar/codigo').send({ email: 'ana@exemplo.com' }).expect(200);
    const certo = codigoDoEmail('ana@exemplo.com');
    const errado = certo === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await api().post('/api/compradores/entrar/confirmar').send({ email: 'ana@exemplo.com', codigo: errado }).expect(401);
    }
    await api().post('/api/compradores/entrar/confirmar').send({ email: 'ana@exemplo.com', codigo: certo }).expect(401);

    for (let i = 0; i < 4; i++) await api().post('/api/compradores/entrar/codigo').send({ email: 'ana@exemplo.com' }).expect(200);
    const barrado = await api().post('/api/compradores/entrar/codigo').send({ email: 'ana@exemplo.com' }).expect(429);
    expect(barrado.body.codigo).toBe('MUITOS_CODIGOS');
  });

  it('perfil: completa WhatsApp e CPF pro próximo checkout; token de comprador não entra no painel', async () => {
    const { acesso } = await entrar('bia@exemplo.com');
    const auth = { Authorization: `Bearer ${acesso}` };
    await api().patch('/api/compradores/eu').set(auth).send({ cpf: '111.111.111-11' }).expect(400);
    const r = await api().patch('/api/compradores/eu').set(auth).send({ nome: 'Beatriz Souza', whatsapp: '(41) 98888-7777', cpf: '529.982.247-25' }).expect(200);
    expect(r.body).toMatchObject({ nome: 'Beatriz Souza', whatsapp: '41988887777', cpf: '52998224725' });
    expect((await api().get('/api/compradores/eu').set(auth).expect(200)).body.nome).toBe('Beatriz Souza');

    // segredo separado: não vale como sessão de fotógrafo
    await api().get('/api/galerias').set(auth).expect(401);
  });

});
