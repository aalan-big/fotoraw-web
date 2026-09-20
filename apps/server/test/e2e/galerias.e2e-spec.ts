import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Fotógrafo E2E',
  email: 'fotografo-galerias@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'fotografo-galerias',
};

const MAQUINA = {
  email: FOTOGRAFO.email,
  senha: FOTOGRAFO.senha,
  fingerprint: 'fp-macbook-galerias-01',
  nomeMaquina: 'MacBook Pro',
};

describe('galerias e sync (e2e)', () => {
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

    await prisma.plano.createMany({
      data: [
        {
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
        {
          codigo: 'pro_mensal',
          nome: 'PRO Mensal',
          precoCentavos: 7900,
          periodicidade: 'MENSAL',
          comissaoEventoPct: 10,
          limiteGaleriasAtivas: null,
          limiteFotosPorGaleria: null,
          limiteArmazenamentoMb: 204800,
          limiteDispositivos: 3,
          permiteEvento: true,
          permiteEnsaio: true,
          permiteGaleriaPrivada: true,
          permiteGestaoEstudio: true,
          ordem: 2,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('fluxo completo: sync pelo desktop e gestão na web pelo fotógrafo', async () => {
    // 1. Cadastra fotógrafo
    const resCad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    const tokenAcessoWeb = resCad.body.acesso;
    expect(tokenAcessoWeb).toBeDefined();

    // 2. Vínculo desktop via /auth/dispositivo
    const resDisp = await api().post('/api/auth/dispositivo').send(MAQUINA).expect(200);
    const tokenApiDesktop = resDisp.body.tokenApi;
    expect(tokenApiDesktop).toBeDefined();

    // 3. Desktop tenta publicar evento
    const lotePayload = {
      chaveIdempotencia: 'lote-desktop-001',
      ensaioIdDesktop: 'ensaio-local-123',
      titulo: 'Corrida da Primavera 2026',
      modalidade: 'EVENTO',
      categoria: 'CORRIDA_RUA',
      modoVenda: 'AVULSO',
      precoFotoCentavos: 1500,
      fotos: [
        {
          fotoIdDesktop: 'foto-001',
          largura: 3000,
          altura: 2000,
          numeroIdentificacao: '142',
          ordem: 1,
        },
        {
          fotoIdDesktop: 'foto-002',
          largura: 3000,
          altura: 2000,
          numeroIdentificacao: '142',
          ordem: 2,
        },
      ],
    };

    const resSync = await api()
      .post('/api/sync/lotes')
      .set('Authorization', `Bearer ${tokenApiDesktop}`)
      .send(lotePayload)
      .expect(201);

    expect(resSync.body.loteId).toBeDefined();
    expect(resSync.body.urlsUpload).toHaveLength(4); // 2 previews + 2 altas
    const loteId = resSync.body.loteId;

    // 4. Desktop confirma upload
    const resConfirm = await api()
      .post(`/api/sync/lotes/${loteId}/confirmar`)
      .set('Authorization', `Bearer ${tokenApiDesktop}`)
      .send({
        fotos: [
          {
            fotoIdDesktop: 'foto-001',
            previewKey: `previews/${resCad.body.conta.id}/${resSync.body.galeriaId}/foto-001.webp`,
          },
          {
            fotoIdDesktop: 'foto-002',
            previewKey: `previews/${resCad.body.conta.id}/${resSync.body.galeriaId}/foto-002.webp`,
          },
        ],
      })
      .expect(201);

    expect(resConfirm.body.status).toBe('CONCLUIDO');
    expect(resConfirm.body.totalFotos).toBe(2);

    // 5. Fotógrafo lista suas galerias na Web
    const resLista = await api()
      .get('/api/galerias')
      .set('Authorization', `Bearer ${tokenAcessoWeb}`)
      .expect(200);

    expect(resLista.body.total).toBe(1);
    expect(resLista.body.itens[0]).toMatchObject({
      titulo: 'Corrida da Primavera 2026',
      modalidade: 'EVENTO',
      status: 'PUBLICADA',
      totalFotos: 2,
    });
    const galeriaId = resLista.body.itens[0].id;

    // 6. Fotógrafo visualiza detalhe da galeria
    const resDetalhe = await api()
      .get(`/api/galerias/${galeriaId}`)
      .set('Authorization', `Bearer ${tokenAcessoWeb}`)
      .expect(200);

    expect(resDetalhe.body.id).toBe(galeriaId);
    expect(resDetalhe.body.fotos).toHaveLength(2);

    // 7. Fotógrafo pausa a galeria
    const resPausa = await api()
      .patch(`/api/galerias/${galeriaId}/status`)
      .set('Authorization', `Bearer ${tokenAcessoWeb}`)
      .send({ status: 'PAUSADA' })
      .expect(200);

    expect(resPausa.body.status).toBe('PAUSADA');

    // 8. Métricas agregadas
    const resMetricas = await api()
      .get('/api/galerias/metricas')
      .set('Authorization', `Bearer ${tokenAcessoWeb}`)
      .expect(200);

    expect(resMetricas.body.totalGalerias).toBe(1);
    expect(resMetricas.body.totalFotos).toBe(2);
  });
});
