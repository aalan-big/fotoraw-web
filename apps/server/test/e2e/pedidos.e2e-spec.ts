import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO_A = {
  nome: 'Fotógrafo Alpha',
  email: 'alpha@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'fotografo-alpha',
};

const FOTOGRAFO_B = {
  nome: 'Fotógrafo Beta',
  email: 'beta@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'fotografo-beta',
};

describe('pedidos e vendas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp((b) =>
      b.overrideProvider(EmailService).useValue({
        enviar: async () => {},
      }),
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

  it('fluxo completo de vendas: listagem, detalhes, métricas e exportação CSV com BOM', async () => {
    // 1. Cadastra fotógrafos A e B
    const resCadA = await api().post('/api/auth/cadastro').send(FOTOGRAFO_A).expect(201);
    const tokenA = resCadA.body.acesso;
    const contaIdA = resCadA.body.conta.id;

    const resCadB = await api().post('/api/auth/cadastro').send(FOTOGRAFO_B).expect(201);
    const tokenB = resCadB.body.acesso;

    // 2. Cria galeria e foto para o fotógrafo A
    const galeria = await prisma.galeria.create({
      data: {
        contaId: contaIdA,
        ensaioIdDesktop: 'ensaio-vendas-001',
        titulo: 'Corrida Noturna Curitiba',
        slug: 'corrida-noturna-curitiba',
        modalidade: 'EVENTO',
        modoVenda: 'AVULSO',
        precoFotoCentavos: 2000,
        status: 'PUBLICADA',
        totalFotos: 1,
      },
    });

    const foto = await prisma.foto.create({
      data: {
        galeriaId: galeria.id,
        fotoIdDesktop: 'foto-100',
        previewKey: `previews/${contaIdA}/${galeria.id}/foto-100.webp`,
        numeroIdentificacao: '501',
        precoCentavos: 2000,
        status: 'ATIVA',
      },
    });

    // 3. Cria comprador e pedido de venda pago
    const comprador = await prisma.comprador.create({
      data: {
        nome: 'Carlos Corredor',
        email: 'carlos@corredor.local',
        whatsapp: '41988887777',
        aceitouTermosEm: new Date(),
      },
    });

    const pedido = await prisma.pedido.create({
      data: {
        contaId: contaIdA,
        galeriaId: galeria.id,
        compradorId: comprador.id,
        status: 'PAGO',
        subtotalCentavos: 2000,
        descontoCentavos: 0,
        taxaClienteCentavos: 0,
        totalCentavos: 2000,
        comissaoPct: 10,
        comissaoCentavos: 200,
        repasseCentavos: 1800,
        pagoEm: new Date(),
        itens: {
          create: {
            fotoId: foto.id,
            precoCentavos: 2000,
          },
        },
        pagamentos: {
          create: {
            provedor: 'MANUAL',
            metodo: 'PIX',
            provedorPagamentoId: 'pix-teste-001',
            status: 'APROVADO',
            valorCentavos: 2000,
            aprovadoEm: new Date(),
          },
        },
        downloads: {
          create: {
            fotoId: foto.id,
            compradorId: comprador.id,
            token: 'token-download-teste-001',
            expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    // 4. Fotógrafo A lista suas vendas
    const resLista = await api()
      .get('/api/pedidos')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(resLista.body.total).toBe(1);
    expect(resLista.body.itens[0]).toMatchObject({
      numero: pedido.numero,
      galeriaTitulo: 'Corrida Noturna Curitiba',
      compradorNome: 'Carlos Corredor',
      totalItens: 1,
      totalCentavos: 2000,
      repasseCentavos: 1800,
      comissaoCentavos: 200,
      status: 'PAGO',
      metodoPagamento: 'PIX',
    });

    // 5. Fotógrafo A consulta detalhes do pedido
    const resDetalhe = await api()
      .get(`/api/pedidos/${pedido.numero}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(resDetalhe.body.numero).toBe(pedido.numero);
    expect(resDetalhe.body.comprador).toMatchObject({
      nome: 'Carlos Corredor',
      email: 'carlos@corredor.local',
      whatsapp: '41988887777',
    });
    expect(resDetalhe.body.itens).toHaveLength(1);
    expect(resDetalhe.body.itens[0].numeroIdentificacao).toBe('501');

    // 6. Fotógrafo A consulta métricas consolidadas
    const resMetricas = await api()
      .get('/api/pedidos/metricas')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(resMetricas.body).toMatchObject({
      totalFaturadoCentavos: 2000,
      totalRepasseCentavos: 1800,
      totalComissaoCentavos: 200,
      totalPedidosPagos: 1,
      ticketMedioCentavos: 2000,
    });

    // 7. Fotógrafo A exporta CSV com BOM
    const resCsv = await api()
      .get('/api/pedidos/exportar-csv')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(resCsv.headers['content-type']).toContain('text/csv');
    expect(resCsv.headers['content-disposition']).toContain('.csv');
    // Verifica a presença do BOM UTF-8 (\uFEFF)
    expect(resCsv.text.charCodeAt(0)).toBe(0xfeff);
    expect(resCsv.text).toContain('Carlos Corredor');
    expect(resCsv.text).toContain('Corrida Noturna Curitiba');
    expect(resCsv.text).toContain('20,00'); // formatado em reais com vírgula
    expect(resCsv.text).toContain('18,00'); // repasse formatado

    // 8. Fotógrafo B não pode ver pedidos do Fotógrafo A (isolamento multitenant)
    await api()
      .get(`/api/pedidos/${pedido.numero}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });
});
