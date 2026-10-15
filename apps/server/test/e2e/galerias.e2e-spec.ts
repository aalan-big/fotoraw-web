import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { StorageService } from '../../src/infra/storage/storage.service.js';
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
  // bucket simulado: chave → tamanho em bytes (o que o desktop "subiu")
  const bucket = new Map<string, number>();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp((b) =>
      b.overrideProvider(EmailService).useValue({
        enviar: async () => {},
      }),
    );
    prisma = app.get(PrismaService);
    const storage = app.get(StorageService);
    vi.spyOn(storage, 'verificarObjetoExiste').mockImplementation(async (_b, chave) => bucket.has(chave));
    vi.spyOn(storage, 'obterTamanhoObjetoBytes').mockImplementation(
      async (_b, chave) => bucket.get(chave) ?? null,
    );
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    bucket.clear();

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
          tamanhoAltaBytes: 5_000_000,
          numeroIdentificacao: '142',
          ordem: 1,
        },
        {
          fotoIdDesktop: 'foto-002',
          largura: 3000,
          altura: 2000,
          tamanhoAltaBytes: 4_000_000,
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
    expect(resSync.body.urlsUpload).toHaveLength(6); // 2 prévias + 2 miniaturas + 2 altas
    const loteId = resSync.body.loteId;
    const base = `${resCad.body.conta.id}/${resSync.body.galeriaId}`;
    // a chave de cada arquivo vem na resposta (prévia/miniatura têm a versão do lote no nome)
    const chave = (foto: string, tipo: string) =>
      resSync.body.urlsUpload.find(
        (u: { fotoIdDesktop: string; tipo: string }) => u.fotoIdDesktop === foto && u.tipo === tipo,
      ).chave as string;
    expect(chave('foto-001', 'preview')).toMatch(/^previews\/.+\/foto-001\.[0-9a-f]{10}\.webp$/);

    // 4a. Sem os arquivos no bucket a confirmação é recusada
    await api()
      .post(`/api/sync/lotes/${loteId}/confirmar`)
      .set('Authorization', `Bearer ${tokenApiDesktop}`)
      .send({ fotos: [{ fotoIdDesktop: 'foto-001' }, { fotoIdDesktop: 'foto-002' }] })
      .expect(400);

    // 4b. Só as prévias subiram: falta a alta → recusa
    bucket.set(chave('foto-001', 'preview'), 200_000);
    bucket.set(chave('foto-002', 'preview'), 200_000);
    bucket.set(chave('foto-001', 'miniatura'), 30_000); // a foto-002 vai sem miniatura
    await api()
      .post(`/api/sync/lotes/${loteId}/confirmar`)
      .set('Authorization', `Bearer ${tokenApiDesktop}`)
      .send({ fotos: [{ fotoIdDesktop: 'foto-001' }, { fotoIdDesktop: 'foto-002' }] })
      .expect(400);

    // 4c. Foto que não é do lote → recusa
    bucket.set(`originais/${base}/foto-001.jpg`, 4_900_000);
    bucket.set(`originais/${base}/foto-002.jpg`, 4_000_000);
    await api()
      .post(`/api/sync/lotes/${loteId}/confirmar`)
      .set('Authorization', `Bearer ${tokenApiDesktop}`)
      .send({ fotos: [{ fotoIdDesktop: 'foto-intrusa' }] })
      .expect(400);

    // 4d. Desktop confirma upload (chaves do corpo são ignoradas)
    const resConfirm = await api()
      .post(`/api/sync/lotes/${loteId}/confirmar`)
      .set('Authorization', `Bearer ${tokenApiDesktop}`)
      .send({
        fotos: [
          {
            fotoIdDesktop: 'foto-001',
            previewKey: 'previews/outra-conta/outra-galeria/roubada.webp',
            altaKey: 'originais/outra-conta/outra-galeria/roubada.jpg',
          },
          {
            fotoIdDesktop: 'foto-002',
          },
        ],
      })
      .expect(201);

    expect(resConfirm.body.status).toBe('CONCLUIDO');
    expect(resConfirm.body.totalFotos).toBe(2);

    const gravadas = await prisma.foto.findMany({ orderBy: { ordem: 'asc' } });
    expect(gravadas.map((f) => f.previewKey)).toEqual([
      chave('foto-001', 'preview'),
      chave('foto-002', 'preview'),
    ]);
    expect(gravadas[0]?.altaKey).toBe(`originais/${base}/foto-001.jpg`);
    expect(Number(gravadas[0]?.tamanhoAltaBytes)).toBe(4_900_000); // medido no bucket
    expect(gravadas[0]?.thumbKey).toBe(chave('foto-001', 'miniatura'));
    expect(gravadas[1]?.thumbKey).toBeNull(); // não subiu: a vitrine usa a prévia

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
  it('evento em modo entrega (sem marca d’água) vira galeria privada com código', async () => {
    await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    const resDisp = await api().post('/api/auth/dispositivo').send(MAQUINA).expect(200);
    const token = resDisp.body.tokenApi;

    const publicar = async (chave: string, modoVenda: 'AVULSO' | 'ENTREGA') => {
      const lote = await api()
        .post('/api/sync/lotes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          chaveIdempotencia: chave,
          ensaioIdDesktop: 'ensaio-entrega',
          titulo: 'Corrida Fechada',
          modalidade: 'EVENTO',
          modoVenda,
          precoFotoCentavos: modoVenda === 'AVULSO' ? 1000 : undefined,
          fotos: [{ fotoIdDesktop: 'f1', tamanhoAltaBytes: 1000 }],
        })
        .expect(201);
      for (const u of lote.body.urlsUpload as { tipo: string; chave: string }[]) {
        bucket.set(u.chave, u.tipo === 'alta' ? 1000 : 100);
      }
      return api()
        .post(`/api/sync/lotes/${lote.body.loteId}/confirmar`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fotos: [{ fotoIdDesktop: 'f1' }] })
        .expect(201);
    };

    // avulso: pública, sem código
    const avulso = await publicar('lote-a', 'AVULSO');
    expect(avulso.body).toMatchObject({ visibilidade: 'PUBLICA', codigoAcesso: null });

    // a mesma galeria republicada como entrega: fecha e ganha código
    const entrega = await publicar('lote-b', 'ENTREGA');
    expect(entrega.body.visibilidade).toBe('PRIVADA');
    expect(entrega.body.codigoAcesso).toMatch(/^FOTO-\d{4}$/);

    // republicar de novo mantém o mesmo código
    const denovo = await publicar('lote-c', 'ENTREGA');
    expect(denovo.body.codigoAcesso).toBe(entrega.body.codigoAcesso);
  });

  it('muda o preço sem reenviar fotos: pelo painel e pelo desktop', async () => {
    const cad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    const web = { Authorization: `Bearer ${cad.body.acesso}` };
    const disp = await api().post('/api/auth/dispositivo').send(MAQUINA).expect(200);
    const desktop = { Authorization: `Bearer ${disp.body.tokenApi}` };
    const contaId = cad.body.conta.id as string;

    const g = await prisma.galeria.create({
      data: { contaId, ensaioIdDesktop: 'ens-precos', titulo: 'Corrida', slug: 'corrida', modoVenda: 'AVULSO', precoFotoCentavos: 1500, status: 'PUBLICADA' },
    });
    await prisma.foto.create({ data: { galeriaId: g.id, fotoIdDesktop: 'f1', previewKey: 'p1', precoCentavos: 2500 } });

    // painel: R$ 15 → R$ 12; a foto que tinha preço próprio passa a seguir a galeria
    const r = await api().patch(`/api/galerias/${g.id}/precos`).set(web).send({ precoFotoCentavos: 1200 }).expect(200);
    expect(r.body.precoFotoCentavos).toBe(1200);
    expect((await prisma.foto.findFirstOrThrow({ where: { galeriaId: g.id } })).precoCentavos).toBeNull();
    await api().patch(`/api/galerias/${g.id}/precos`).set(web).send({ precoFotoCentavos: 50 }).expect(400); // < R$ 1
    await api().patch(`/api/galerias/${g.id}/precos`).set(web).send({ precoFotoCentavos: null }).expect(400); // avulso sem preço
    await api().patch(`/api/galerias/${g.id}/precos`).set(web).send({}).expect(400);

    // desktop ("salvar só os valores"): pelo id do ensaio, com o token da máquina
    const d = await api().patch('/api/sync/galerias/ens-precos/precos').set(desktop).send({ precoFotoCentavos: 1000 }).expect(200);
    expect(d.body.precoFotoCentavos).toBe(1000);
    await api().patch('/api/sync/galerias/nao-publicado/precos').set(desktop).send({ precoFotoCentavos: 1000 }).expect(404);

    // entrega não tem preço; galeria de outra conta não é achada
    const entrega = await prisma.galeria.create({
      data: { contaId, ensaioIdDesktop: 'ens-entrega', titulo: 'Entrega', slug: 'entrega', modoVenda: 'ENTREGA', status: 'PUBLICADA' },
    });
    await api().patch(`/api/galerias/${entrega.id}/precos`).set(web).send({ precoFotoCentavos: 1000 }).expect(400);
    await api().patch('/api/galerias/01a13fa3-7a33-70ad-a7b0-f04a3acc72c4/precos').set(web).send({ precoFotoCentavos: 1000 }).expect(404);
  });
});
