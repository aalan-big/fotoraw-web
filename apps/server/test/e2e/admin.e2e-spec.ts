import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService, type Email } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { SenhaService } from '../../src/modulos/auth/senha/senha.service.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Estúdio Teste',
  email: 'contato@estudioteste.com',
  senha: 'frase-longa-e-segura-2026',
  slug: 'estudio-teste',
};
const SENHA_ADMIN = 'senha-do-dono-2026';

describe('admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: Email[] = [];
  const api = () => request(app.getHttpServer());
  let planoPro: string;

  beforeAll(async () => {
    app = await criarApp((b) =>
      b.overrideProvider(EmailService).useValue({
        enviar: async (e: Email) => {
          emails.push(e);
        },
      }),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    emails.length = 0;
    const [, p] = await Promise.all([
      prisma.plano.create({
        data: {
          codigo: 'gratuito',
          nome: 'Gratuito',
          precoCentavos: 0,
          periodicidade: 'NENHUMA',
          comissaoEventoPct: 10,
          limiteGaleriasAtivas: 5,
          limiteDispositivos: 1,
          ordem: 1,
        },
      }),
      prisma.plano.create({
        data: {
          codigo: 'pro_mensal',
          nome: 'PRO',
          precoCentavos: 4990,
          periodicidade: 'MENSAL',
          comissaoEventoPct: 10,
          limiteArmazenamentoMb: 204800,
          limiteDispositivos: 3,
          permiteGaleriaPrivada: true,
          permiteEnsaio: true,
          permiteGestaoEstudio: true,
          ordem: 2,
        },
      }),
    ]);
    planoPro = p.id;
    await prisma.configuracaoPlataforma.create({ data: { chave: 'trial_dias', valor: 14 } });
    // o admin nasce fora do cadastro público (scripts/criar-admin.ts)
    await prisma.conta.create({
      data: {
        nome: 'Dono',
        email: 'dono@fotoraw.local',
        senhaHash: await app.get(SenhaService).hash(SENHA_ADMIN),
        slug: 'admin-dono',
        papel: 'ADMIN',
        emailVerificadoEm: new Date(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function entrarAdmin(): Promise<string> {
    const r = await api()
      .post('/api/auth/admin/login')
      .send({ email: 'dono@fotoraw.local', senha: SENHA_ADMIN })
      .expect(200);
    return `Bearer ${r.body.acesso}`;
  }
  /** cadastra o fotógrafo (ganha trial) e devolve { id, bearer } */
  async function cadastrarFotografo() {
    const r = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    return { id: r.body.conta.id as string, bearer: `Bearer ${r.body.acesso}` };
  }
  async function tokenDesktop() {
    const r = await api()
      .post('/api/auth/dispositivo')
      .send({
        email: FOTOGRAFO.email,
        senha: FOTOGRAFO.senha,
        fingerprint: 'fp-notebook-0001',
        nomeMaquina: 'Notebook',
      })
      .expect(200);
    return `Bearer ${r.body.tokenApi}`;
  }

  // ---------------------------------------------------------------------------

  describe('acesso', () => {
    it('fotógrafo não entra em /admin; sem token é 401', async () => {
      const { bearer } = await cadastrarFotografo();
      await api().get('/api/admin/contas').expect(401);
      const r = await api().get('/api/admin/contas').set('Authorization', bearer).expect(403);
      expect(r.body.codigo).toBe('SEM_PERMISSAO');
    });

    it('admin lista, busca e vê o detalhe de uma conta', async () => {
      const { id } = await cadastrarFotografo();
      const admin = await entrarAdmin();

      const lista = await api().get('/api/admin/contas').set('Authorization', admin).expect(200);
      expect(lista.body.total).toBe(1);
      expect(lista.body.itens[0]).toMatchObject({
        slug: 'estudio-teste',
        plano: 'trial',
        emailVerificado: false,
      });
      // o próprio admin não aparece na lista de fotógrafos
      expect(
        lista.body.itens.find((c: { slug: string }) => c.slug === 'admin-dono'),
      ).toBeUndefined();

      const busca = await api()
        .get('/api/admin/contas?q=@estudio-t&plano=trial')
        .set('Authorization', admin)
        .expect(200);
      expect(busca.body.total).toBe(1);
      const nada = await api()
        .get('/api/admin/contas?plano=pro')
        .set('Authorization', admin)
        .expect(200);
      expect(nada.body.total).toBe(0);

      const det = await api()
        .get(`/api/admin/contas/${id}`)
        .set('Authorization', admin)
        .expect(200);
      expect(det.body.conta.senhaHash).toBeUndefined();
      expect(det.body.licencaAtual.plano).toBe('trial');
      expect(det.body.licencas).toHaveLength(1);
      expect(det.body.vendas.pedidosPagos).toBe(0);
      expect(det.body.auditorias.some((a: { acao: string }) => a.acao === 'conta.criada')).toBe(
        true,
      );
    });
  });

  describe('licenças', () => {
    it('emitir cortesia substitui o trial; desktop e painel veem o novo plano', async () => {
      const { id, bearer } = await cadastrarFotografo();
      const desktop = await tokenDesktop();
      const admin = await entrarAdmin();

      const validaAte = new Date(Date.now() + 90 * 24 * 3600 * 1000);
      const r = await api()
        .post('/api/admin/licencas')
        .set('Authorization', admin)
        .send({
          contaId: id,
          tipo: 'CORTESIA',
          planoBaseId: planoPro,
          validaAte,
          motivo: 'parceiro do lançamento',
          recursos: { limite_dispositivos: 5 },
        })
        .expect(201);
      expect(r.body.revogadas).toBe(1);
      expect(r.body.licenca).toMatchObject({ tipo: 'CORTESIA', status: 'ATIVA' });
      expect(r.body.licenca.recursos).toMatchObject({
        limite_dispositivos: 5,
        permite_gestao_estudio: true,
      });
      expect(r.body.licenca.chave).toMatch(/^FR-/);

      // trial anterior virou revogada
      const hist = await api()
        .get(`/api/admin/contas/${id}/licencas`)
        .set('Authorization', admin)
        .expect(200);
      expect(
        hist.body.map((l: { tipo: string; status: string }) => `${l.tipo}:${l.status}`),
      ).toEqual(['CORTESIA:ATIVA', 'TRIAL:REVOGADA']);

      // desktop e painel
      const lic = await api().get('/api/licencas/atual').set('Authorization', desktop).expect(200);
      expect(lic.body).toMatchObject({
        plano: 'pro',
        tipo: 'CORTESIA',
        recursos: { limite_dispositivos: 5 },
      });
      const me = await api().get('/api/me').set('Authorization', bearer).expect(200);
      expect(me.body.licenca.tipo).toBe('CORTESIA');

      const aud = await prisma.auditoria.findFirst({
        where: { acao: 'licenca.emitir' },
        include: { ator: true },
      });
      expect(aud?.ator?.papel).toBe('ADMIN');
    });

    it('vitalícia não precisa de validade; cortesia sem validade é recusada', async () => {
      const { id } = await cadastrarFotografo();
      const admin = await entrarAdmin();
      await api()
        .post('/api/admin/licencas')
        .set('Authorization', admin)
        .send({ contaId: id, tipo: 'CORTESIA', planoBaseId: planoPro, motivo: 'sem validade' })
        .expect(400);
      const r = await api()
        .post('/api/admin/licencas')
        .set('Authorization', admin)
        .send({ contaId: id, tipo: 'VITALICIA', planoBaseId: planoPro, motivo: 'fundador' })
        .expect(201);
      expect(r.body.licenca.validaAte).toBeNull();
    });

    it('suspender derruba pro gratuito; reativar volta; revogar é definitivo', async () => {
      const { id } = await cadastrarFotografo();
      const desktop = await tokenDesktop();
      const admin = await entrarAdmin();
      const trial = await prisma.licenca.findFirstOrThrow({ where: { contaId: id } });

      await api()
        .patch(`/api/admin/licencas/${trial.id}/status`)
        .set('Authorization', admin)
        .send({ status: 'SUSPENSA', motivo: 'pagamento pendente' })
        .expect(200);
      let lic = await api().get('/api/licencas/atual').set('Authorization', desktop).expect(200);
      expect(lic.body.plano).toBe('gratuito');
      expect(lic.body.recursos.permite_gestao_estudio).toBe(false);

      await api()
        .patch(`/api/admin/licencas/${trial.id}/status`)
        .set('Authorization', admin)
        .send({ status: 'ATIVA', motivo: 'regularizou' })
        .expect(200);
      lic = await api().get('/api/licencas/atual').set('Authorization', desktop).expect(200);
      expect(lic.body.plano).toBe('trial');

      await api()
        .patch(`/api/admin/licencas/${trial.id}/status`)
        .set('Authorization', admin)
        .send({ status: 'REVOGADA', motivo: 'abuso' })
        .expect(200);
      const r = await api()
        .patch(`/api/admin/licencas/${trial.id}/status`)
        .set('Authorization', admin)
        .send({ status: 'ATIVA', motivo: 'tentativa' })
        .expect(422);
      expect(r.body.codigo).toBe('LICENCA_ENCERRADA');
    });

    it('lista com filtros de tipo/status e vencimento', async () => {
      await cadastrarFotografo();
      const admin = await entrarAdmin();
      const r = await api()
        .get('/api/admin/licencas?tipo=TRIAL&status=ATIVA&venceEmDias=30')
        .set('Authorization', admin)
        .expect(200);
      expect(r.body.total).toBe(1);
      expect(r.body.itens[0].conta.slug).toBe('estudio-teste');
      const zero = await api()
        .get('/api/admin/licencas?venceEmDias=3')
        .set('Authorization', admin)
        .expect(200);
      expect(zero.body.total).toBe(0);
    });
  });

  describe('status da conta', () => {
    it('bloquear derruba painel e desktop; reativar libera de novo', async () => {
      const { id, bearer } = await cadastrarFotografo();
      const desktop = await tokenDesktop();
      const admin = await entrarAdmin();

      await api()
        .patch(`/api/admin/contas/${id}/status`)
        .set('Authorization', admin)
        .send({ status: 'BLOQUEADA', motivo: 'fraude' })
        .expect(200);
      await api().get('/api/me').set('Authorization', bearer).expect(403);
      // o token do desktop foi revogado no bloqueio → 401 (não 403)
      await api().get('/api/licencas/atual').set('Authorization', desktop).expect(401);
      await api()
        .post('/api/auth/login')
        .send({ email: FOTOGRAFO.email, senha: FOTOGRAFO.senha })
        .expect(403);

      await api()
        .patch(`/api/admin/contas/${id}/status`)
        .set('Authorization', admin)
        .send({ status: 'ATIVA', motivo: 'engano' })
        .expect(200);
      await api()
        .post('/api/auth/login')
        .send({ email: FOTOGRAFO.email, senha: FOTOGRAFO.senha })
        .expect(200);
      // tokens do desktop foram revogados no bloqueio: precisa reconectar
      await api().get('/api/licencas/atual').set('Authorization', desktop).expect(401);

      const acoes = (
        await prisma.auditoria.findMany({ where: { alvoId: id, acao: { startsWith: 'conta.' } } })
      ).map((a) => a.acao);
      expect(acoes).toEqual(expect.arrayContaining(['conta.bloqueada', 'conta.ativa']));
    });

    it('reenviar verificação e revogar dispositivo', async () => {
      const { id } = await cadastrarFotografo();
      const desktop = await tokenDesktop();
      const admin = await entrarAdmin();
      const antes = emails.length;
      await api()
        .post(`/api/admin/contas/${id}/reenviar-verificacao`)
        .set('Authorization', admin)
        .expect(204);
      expect(emails.length).toBe(antes + 1);

      const det = await api()
        .get(`/api/admin/contas/${id}`)
        .set('Authorization', admin)
        .expect(200);
      expect(det.body.dispositivos[0].conectado).toBe(true);
      await api()
        .delete(`/api/admin/contas/${id}/dispositivos/${det.body.dispositivos[0].id}`)
        .set('Authorization', admin)
        .expect(204);
      await api().get('/api/licencas/atual').set('Authorization', desktop).expect(401);
    });
  });
});
