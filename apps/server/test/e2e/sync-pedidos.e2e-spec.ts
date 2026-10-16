import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { fotoFixture, galeriaEventoFixture } from '../fixtures/index.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const SENHA = 'senha-segura-e2e-2026';

describe('desktop puxa as vendas: GET /sync/pedidos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp((b) =>
      b.overrideProvider(EmailService).useValue({ enviar: async () => {} }),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    await prisma.plano.create({
      data: {
        codigo: 'gratuito',
        nome: 'Gratuito',
        precoCentavos: 0,
        periodicidade: 'NENHUMA',
        comissaoEventoPct: 10,
        limiteGaleriasAtivas: 5,
        limiteFotosPorGaleria: 2000,
        limiteArmazenamentoMb: 20480,
        limiteDispositivos: 1,
        permiteEvento: true,
        permiteEnsaio: false,
        permiteGaleriaPrivada: false,
        permiteGestaoEstudio: false,
        ordem: 1,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Cadastra o fotógrafo, vincula a máquina e devolve o header do desktop. */
  async function desktop(slug: string) {
    const email = `${slug}@fotoraw.local`;
    const cad = await api()
      .post('/api/auth/cadastro')
      .send({ nome: slug, email, senha: SENHA, slug })
      .expect(201);
    const disp = await api()
      .post('/api/auth/dispositivo')
      .send({ email, senha: SENHA, fingerprint: `fp-${slug}`, nomeMaquina: 'PC' })
      .expect(200);
    return {
      contaId: cad.body.conta.id as string,
      header: { Authorization: `Bearer ${disp.body.tokenApi}` },
    };
  }

  async function venda(
    contaId: string,
    galeriaId: string,
    fotoId: string,
    extra: Record<string, unknown> = {},
  ) {
    const comprador = await prisma.comprador.upsert({
      where: { email: 'ana@compra.local' },
      create: {
        nome: 'Ana',
        email: 'ana@compra.local',
        whatsapp: '41999990000',
        aceitouTermosEm: new Date(),
      },
      update: {},
    });
    return prisma.pedido.create({
      data: {
        contaId,
        galeriaId,
        compradorId: comprador.id,
        status: 'PAGO',
        subtotalCentavos: 1500,
        totalCentavos: 1500,
        comissaoPct: 10,
        comissaoCentavos: 150,
        repasseCentavos: 1350,
        pagoEm: new Date(),
        itens: { create: [{ fotoId, precoCentavos: 1500 }] },
        ...extra,
      },
    });
  }

  it('devolve o que o desktop precisa, marca como sincronizado e não repete', async () => {
    const { contaId, header } = await desktop('sync-pedidos-a');
    const galeria = await prisma.galeria.create({
      data: galeriaEventoFixture(contaId, { ensaioIdDesktop: 'ens-local-1' }),
    });
    const foto = await prisma.foto.create({
      data: fotoFixture(galeria.id, { fotoIdDesktop: 'foto-local-1', numeroIdentificacao: '142' }),
    });
    const pedido = await venda(contaId, galeria.id, foto.id);
    // pedido não pago não sai
    await venda(contaId, galeria.id, foto.id, { status: 'AGUARDANDO_PAGAMENTO', pagoEm: null });

    const r = await api().get('/api/sync/pedidos').set(header).expect(200);
    expect(r.body.temMais).toBe(false);
    expect(r.body.pedidos).toHaveLength(1);
    expect(r.body.pedidos[0]).toMatchObject({
      id: pedido.id,
      numero: pedido.numero.toString(),
      ensaioIdDesktop: 'ens-local-1',
      status: 'PAGO',
      comprador: { nome: 'Ana', email: 'ana@compra.local', whatsapp: '41999990000' },
      subtotalCentavos: 1500,
      comissaoCentavos: 150,
      repasseCentavos: 1350,
      itens: [
        {
          fotoIdDesktop: 'foto-local-1',
          numeroIdentificacao: '142',
          precoCentavos: 1500,
          incluida: false,
        },
      ],
    });

    const marcado = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(marcado.sincronizadoDesktopEm).not.toBeNull();
    // marcar não mexe no atualizadoEm: com o cursor, o pedido não volta
    expect(marcado.atualizadoEm.getTime()).toBe(pedido.atualizadoEm.getTime());
    const de_novo = await api()
      .get('/api/sync/pedidos')
      .query({ cursor: r.body.cursor })
      .set(header)
      .expect(200);
    expect(de_novo.body.pedidos).toHaveLength(0);
    expect(de_novo.body.cursor).toBe(r.body.cursor);
  });

  it('estorno volta como ESTORNADO na próxima puxada', async () => {
    const { contaId, header } = await desktop('sync-pedidos-b');
    const galeria = await prisma.galeria.create({ data: galeriaEventoFixture(contaId) });
    const foto = await prisma.foto.create({ data: fotoFixture(galeria.id) });
    const pedido = await venda(contaId, galeria.id, foto.id);

    const r1 = await api().get('/api/sync/pedidos').set(header).expect(200);
    await prisma.pedido.update({ where: { id: pedido.id }, data: { status: 'ESTORNADO' } });

    const r2 = await api()
      .get('/api/sync/pedidos')
      .query({ cursor: r1.body.cursor })
      .set(header)
      .expect(200);
    expect(r2.body.pedidos).toHaveLength(1);
    expect(r2.body.pedidos[0]).toMatchObject({ id: pedido.id, status: 'ESTORNADO' });
  });

  it('pagina por cursor sem perder pedido no mesmo instante', async () => {
    const { contaId, header } = await desktop('sync-pedidos-c');
    const galeria = await prisma.galeria.create({ data: galeriaEventoFixture(contaId) });
    const foto = await prisma.foto.create({ data: fotoFixture(galeria.id) });
    const mesmoInstante = new Date('2026-10-16T12:00:00.000Z');
    const criados = [];
    for (let i = 0; i < 205; i++) criados.push((await venda(contaId, galeria.id, foto.id)).id);
    // todos com o mesmo atualizadoEm: só o desempate por id segura a paginação
    await prisma.$executeRaw`UPDATE pedidos SET atualizado_em = ${mesmoInstante} WHERE conta_id = ${contaId}::uuid`;

    const p1 = await api().get('/api/sync/pedidos').set(header).expect(200);
    expect(p1.body.pedidos).toHaveLength(200);
    expect(p1.body.temMais).toBe(true);
    const p2 = await api()
      .get('/api/sync/pedidos')
      .query({ cursor: p1.body.cursor })
      .set(header)
      .expect(200);
    expect(p2.body.pedidos).toHaveLength(5);
    expect(p2.body.temMais).toBe(false);

    const recebidos = [...p1.body.pedidos, ...p2.body.pedidos].map((p: { id: string }) => p.id);
    expect(new Set(recebidos).size).toBe(205);
    expect(new Set(recebidos)).toEqual(new Set(criados));
  });

  it('um fotógrafo não vê as vendas do outro; cursor torto é 400; sem token é 401', async () => {
    const a = await desktop('sync-pedidos-d');
    const b = await desktop('sync-pedidos-e');
    const galeria = await prisma.galeria.create({ data: galeriaEventoFixture(a.contaId) });
    const foto = await prisma.foto.create({ data: fotoFixture(galeria.id) });
    await venda(a.contaId, galeria.id, foto.id);

    const rb = await api().get('/api/sync/pedidos').set(b.header).expect(200);
    expect(rb.body.pedidos).toHaveLength(0);
    await api().get('/api/sync/pedidos').query({ cursor: 'ontem' }).set(a.header).expect(400);
    await api().get('/api/sync/pedidos').expect(401);
  });
});
