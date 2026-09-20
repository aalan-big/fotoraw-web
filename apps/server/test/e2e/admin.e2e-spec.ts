import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService, type Email } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { SenhaService } from '../../src/modulos/auth/senha/senha.service.js';
import { galeriaEventoFixture } from '../fixtures/galeria.fixture.js';
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

    it('resumo 360: saúde, uso contra o plano e linha do tempo unificada', async () => {
      const { id } = await cadastrarFotografo();
      const admin = await entrarAdmin();
      let r = await api()
        .get(`/api/admin/contas/${id}/resumo`)
        .set('Authorization', admin)
        .expect(200);
      expect(r.body.conta).toMatchObject({ id, emailVerificado: false });
      expect(r.body.licenca.plano).toBe('trial');
      expect(r.body.saude.nivel).toBe('atencao');
      expect(r.body.saude.alertas.map((a: { codigo: string }) => a.codigo)).toContain(
        'email_nao_confirmado',
      );
      expect(r.body.uso).toMatchObject({ dispositivosConectados: 0, limiteDispositivos: 3 });
      const textos = r.body.linhaDoTempo.map((e: { texto: string }) => e.texto);
      expect(textos).toEqual(
        expect.arrayContaining(['Conta criada', expect.stringMatching(/^Licença trial emitida/)]),
      );

      // desktop conecta e o admin suspende: os dois aparecem na linha do tempo
      await tokenDesktop();
      await api()
        .patch(`/api/admin/contas/${id}/status`)
        .set('Authorization', admin)
        .send({ status: 'SUSPENSA', motivo: 'teste' })
        .expect(200);
      r = await api().get(`/api/admin/contas/${id}/resumo`).set('Authorization', admin).expect(200);
      expect(r.body.saude.nivel).toBe('critico');
      expect(r.body.uso.dispositivosConectados).toBe(1);
      expect(r.body.linhaDoTempo[0]).toMatchObject({
        tipo: 'admin',
        texto: 'Conta suspensa pelo admin — teste',
        ator: 'Dono',
      });
      expect(r.body.linhaDoTempo.map((e: { tipo: string }) => e.tipo)).toContain('desktop');
      await api()
        .get('/api/admin/contas/00000000-0000-7000-8000-000000000000/resumo')
        .set('Authorization', admin)
        .expect(404);
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

  describe('planos', () => {
    it('lista com comissão numérica e contagem de licenças ativas; editar audita antes/depois', async () => {
      await cadastrarFotografo(); // ganha trial do pro_mensal
      const admin = await entrarAdmin();

      const lista = await api().get('/api/admin/planos').set('Authorization', admin).expect(200);
      const pro = lista.body.find((p: { codigo: string }) => p.codigo === 'pro_mensal');
      expect(pro).toMatchObject({ comissaoEventoPct: 10, licencasAtivas: 1, ativo: true });

      const r = await api()
        .patch(`/api/admin/planos/${planoPro}`)
        .set('Authorization', admin)
        .send({ precoCentavos: 5990, limiteDispositivos: 5, comissaoEventoPct: 8.5 })
        .expect(200);
      expect(r.body).toMatchObject({
        precoCentavos: 5990,
        limiteDispositivos: 5,
        comissaoEventoPct: 8.5,
      });

      // codigo não se edita; corpo vazio é recusado
      await api()
        .patch(`/api/admin/planos/${planoPro}`)
        .set('Authorization', admin)
        .send({ codigo: 'outro' })
        .expect(400);

      const aud = await prisma.auditoria.findFirstOrThrow({ where: { acao: 'plano.editar' } });
      expect(aud.antes).toMatchObject({ precoCentavos: 4990, limiteDispositivos: 3 });
      expect(aud.depois).toMatchObject({
        precoCentavos: 5990,
        limiteDispositivos: 5,
        comissaoEventoPct: 8.5,
      });
    });

    it('editar não muda licença emitida; reemitir aplica nas ativas do plano', async () => {
      const { bearer } = await cadastrarFotografo();
      const admin = await entrarAdmin();

      await api()
        .patch(`/api/admin/planos/${planoPro}`)
        .set('Authorization', admin)
        .send({ limiteDispositivos: 7 })
        .expect(200);
      let me = await api().get('/api/me').set('Authorization', bearer).expect(200);
      expect(me.body.licenca.recursos.limite_dispositivos).toBe(3);

      const r = await api()
        .post(`/api/admin/planos/${planoPro}/reemitir`)
        .set('Authorization', admin)
        .send({ motivo: 'mais máquinas pra todo mundo' })
        .expect(200);
      expect(r.body.atualizadas).toBe(1);
      me = await api().get('/api/me').set('Authorization', bearer).expect(200);
      expect(me.body.licenca.recursos.limite_dispositivos).toBe(7);
      expect(me.body.licenca.tipo).toBe('TRIAL'); // mesma licença, só o snapshot mudou
      expect(await prisma.auditoria.count({ where: { acao: 'plano.reemitir' } })).toBe(1);
    });
  });

  describe('configurações', () => {
    it('lista o catálogo com padrão pra chave ausente; alterar valida por chave e vale no cadastro', async () => {
      const admin = await entrarAdmin();
      const lista = await api()
        .get('/api/admin/configuracoes')
        .set('Authorization', admin)
        .expect(200);
      const chaves = lista.body.map((c: { chave: string }) => c.chave);
      expect(chaves).toEqual(
        expect.arrayContaining(['trial_dias', 'comissao_padrao_pct', 'email_suporte']),
      );
      expect(lista.body.find((c: { chave: string }) => c.chave === 'trial_dias')).toMatchObject({
        valor: 14,
        atualizadoEm: expect.any(String),
      });
      // sem linha no banco → padrão
      expect(lista.body.find((c: { chave: string }) => c.chave === 'email_suporte')).toMatchObject({
        valor: 'suporte@fotoraw.com.br',
        atualizadoEm: null,
      });

      await api()
        .put('/api/admin/configuracoes/trial_dias')
        .set('Authorization', admin)
        .send({ valor: 'trinta' })
        .expect(400);
      await api()
        .put('/api/admin/configuracoes/chave_que_nao_existe')
        .set('Authorization', admin)
        .send({ valor: 1 })
        .expect(404);
      await api()
        .put('/api/admin/configuracoes/email_suporte')
        .set('Authorization', admin)
        .send({ valor: 'nao-e-email' })
        .expect(400);

      await api()
        .put('/api/admin/configuracoes/trial_dias')
        .set('Authorization', admin)
        .send({ valor: 30 })
        .expect(200)
        .expect((r) => expect(r.body.valor).toBe(30));
      const aud = await prisma.auditoria.findFirstOrThrow({ where: { acao: 'config.alterar' } });
      expect(aud.antes).toEqual({ valor: 14 });
      expect(aud.depois).toEqual({ valor: 30 });

      // o cadastro seguinte ganha 30 dias
      const cad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
      const me = await api()
        .get('/api/me')
        .set('Authorization', `Bearer ${cad.body.acesso}`)
        .expect(200);
      expect(me.body.licenca.diasRestantes).toBe(30);
    });
  });

  describe('assinaturas manuais', () => {
    const DIA = 24 * 3600 * 1000;
    const dataUtc = (iso: string) => iso.slice(0, 10);

    it('criar já paga emite licença ASSINATURA e gera a próxima fatura; marcar paga estende', async () => {
      const { id, bearer } = await cadastrarFotografo();
      const admin = await entrarAdmin();

      const criada = await api()
        .post('/api/admin/assinaturas')
        .set('Authorization', admin)
        .send({
          contaId: id,
          planoId: planoPro,
          inicioEm: '2026-09-01',
          jaPaga: true,
          observacao: 'pix',
        })
        .expect(201);
      expect(criada.body).toMatchObject({ status: 'ATIVA', provedor: 'MANUAL', origem: 'ADMIN' });
      expect(dataUtc(criada.body.periodoAtualInicio)).toBe('2026-09-01');
      expect(dataUtc(criada.body.periodoAtualFim)).toBe('2026-10-01');
      const faturas = criada.body.faturas.map(
        (f: { status: string; vencimento: string }) => `${f.status}:${dataUtc(f.vencimento)}`,
      );
      expect(faturas).toEqual(['PENDENTE:2026-10-01', 'PAGA:2026-09-01']);
      expect(criada.body.licencas[0]).toMatchObject({ status: 'ATIVA' });
      expect(dataUtc(criada.body.licencas[0].validaAte)).toBe('2026-10-01');

      // painel do fotógrafo vê PRO por assinatura; o trial virou revogada
      const me = await api().get('/api/me').set('Authorization', bearer).expect(200);
      expect(me.body.licenca).toMatchObject({ plano: 'pro', tipo: 'ASSINATURA' });
      const hist = await api()
        .get(`/api/admin/contas/${id}/licencas`)
        .set('Authorization', admin)
        .expect(200);
      expect(
        hist.body.map((l: { tipo: string; status: string }) => `${l.tipo}:${l.status}`),
      ).toEqual(['ASSINATURA:ATIVA', 'TRIAL:REVOGADA']);

      // paga a 2ª fatura: mesma licença, validade estendida, 3ª fatura nasce
      const pendente = criada.body.faturas.find((f: { status: string }) => f.status === 'PENDENTE');
      const paga = await api()
        .patch(`/api/admin/faturas/${pendente.id}/marcar-paga`)
        .set('Authorization', admin)
        .send({ pagaEm: '2026-09-28T12:00:00Z' })
        .expect(200);
      expect(dataUtc(paga.body.periodoAtualFim)).toBe('2026-11-01');
      expect(paga.body.licencas).toHaveLength(1);
      expect(dataUtc(paga.body.licencas[0].validaAte)).toBe('2026-11-01');
      expect(
        paga.body.faturas.filter((f: { status: string }) => f.status === 'PENDENTE'),
      ).toHaveLength(1);
      await api()
        .patch(`/api/admin/faturas/${pendente.id}/marcar-paga`)
        .set('Authorization', admin)
        .send({})
        .expect(422);

      // segunda assinatura na mesma conta é recusada; plano gratuito também
      await api()
        .post('/api/admin/assinaturas')
        .set('Authorization', admin)
        .send({ contaId: id, planoId: planoPro })
        .expect(409);

      const acoes = (
        await prisma.auditoria.findMany({ where: { acao: { startsWith: 'assinatura.' } } })
      ).map((a) => a.acao);
      expect(acoes).toContain('assinatura.criar');
      expect(await prisma.auditoria.count({ where: { acao: 'fatura.marcar_paga' } })).toBe(2);
    });

    it('cancelar no fim mantém a licença até vencer; cancelar agora revoga e cai no gratuito', async () => {
      const { id, bearer } = await cadastrarFotografo();
      const admin = await entrarAdmin();
      const hoje = new Date().toISOString().slice(0, 10);
      const a = await api()
        .post('/api/admin/assinaturas')
        .set('Authorization', admin)
        .send({ contaId: id, planoId: planoPro, inicioEm: hoje, jaPaga: true })
        .expect(201);

      const fim = await api()
        .patch(`/api/admin/assinaturas/${a.body.id}/cancelar`)
        .set('Authorization', admin)
        .send({ noFimDoPeriodo: true, motivo: 'pediu pra parar' })
        .expect(200);
      expect(fim.body).toMatchObject({ status: 'ATIVA', cancelaNoFimDoPeriodo: true });
      expect(fim.body.faturas.map((f: { status: string }) => f.status)).toEqual([
        'CANCELADA',
        'PAGA',
      ]);
      let me = await api().get('/api/me').set('Authorization', bearer).expect(200);
      expect(me.body.licenca.plano).toBe('pro');

      const agora = await api()
        .patch(`/api/admin/assinaturas/${a.body.id}/cancelar`)
        .set('Authorization', admin)
        .send({ noFimDoPeriodo: false, motivo: 'chargeback' })
        .expect(200);
      expect(agora.body.status).toBe('CANCELADA');
      expect(agora.body.licencas[0].status).toBe('REVOGADA');
      me = await api().get('/api/me').set('Authorization', bearer).expect(200);
      expect(me.body.licenca.plano).toBe('gratuito');
      await api()
        .patch(`/api/admin/assinaturas/${a.body.id}/cancelar`)
        .set('Authorization', admin)
        .send({ noFimDoPeriodo: false, motivo: 'de novo' })
        .expect(422);
    });

    it('fatura pendente vencida vira VENCIDA e a assinatura INADIMPLENTE na leitura; pagar volta', async () => {
      const { id } = await cadastrarFotografo();
      const admin = await entrarAdmin();
      const passado = new Date(Date.now() - 40 * DIA).toISOString().slice(0, 10);
      const a = await api()
        .post('/api/admin/assinaturas')
        .set('Authorization', admin)
        .send({ contaId: id, planoId: planoPro, inicioEm: passado, jaPaga: false })
        .expect(201);
      expect(a.body.status).toBe('INADIMPLENTE');
      expect(a.body.faturas[0].status).toBe('VENCIDA');
      expect(a.body.licencas).toHaveLength(0);

      const lista = await api()
        .get('/api/admin/assinaturas?vencidas=true')
        .set('Authorization', admin)
        .expect(200);
      expect(lista.body.total).toBe(1);
      expect(lista.body.numeros).toMatchObject({ ativas: 0, faturasVencidas: 1 });

      const paga = await api()
        .patch(`/api/admin/faturas/${a.body.faturas[0].id}/marcar-paga`)
        .set('Authorization', admin)
        .send({})
        .expect(200);
      expect(paga.body.status).toBe('ATIVA');
      expect(paga.body.licencas[0].status).toBe('ATIVA');
      // pagou depois do período acabar: o período novo começa hoje
      const hoje = new Date();
      expect(paga.body.periodoAtualInicio.slice(0, 10)).toBe(
        new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()))
          .toISOString()
          .slice(0, 10),
      );
      const numeros = await api()
        .get('/api/admin/assinaturas')
        .set('Authorization', admin)
        .expect(200);
      expect(numeros.body.numeros).toMatchObject({
        ativas: 1,
        mrrCentavos: 4990,
        faturasVencidas: 0,
      });
    });
  });

  describe('financeiro', () => {
    const DIA = 24 * 3600 * 1000;
    /** pedido pago: 10% de comissão, 1% de taxa, o resto é do fotógrafo */
    async function venda(contaId: string, totalCentavos: number, pagoEm: Date) {
      const galeria = await prisma.galeria.create({ data: galeriaEventoFixture(contaId) });
      const comprador = await prisma.comprador.upsert({
        where: { email: 'comprador@x.com' },
        update: {},
        create: { email: 'comprador@x.com', nome: 'Comprador', aceitouTermosEm: new Date() },
      });
      const comissao = Math.round(totalCentavos * 0.1);
      const taxa = Math.round(totalCentavos * 0.01);
      return prisma.pedido.create({
        data: {
          contaId,
          galeriaId: galeria.id,
          compradorId: comprador.id,
          status: 'PAGO',
          subtotalCentavos: totalCentavos,
          totalCentavos,
          comissaoPct: 10,
          comissaoCentavos: comissao,
          taxaProvedorCentavos: taxa,
          repasseCentavos: totalCentavos - comissao - taxa,
          pagoEm,
        },
      });
    }

    it('resumo do período, saldos por fotógrafo e fila de repasses (gerar → pagar / falhou)', async () => {
      const { id } = await cadastrarFotografo();
      const admin = await entrarAdmin();
      await venda(id, 10000, new Date(Date.now() - 2 * DIA));
      await venda(id, 5000, new Date(Date.now() - 1 * DIA));
      await venda(id, 20000, new Date(Date.now() - 90 * DIA)); // fora do período
      const hoje = new Date();
      const de = new Date(hoje.getTime() - 7 * DIA).toISOString().slice(0, 10);
      const ate = hoje.toISOString().slice(0, 10);

      const r = await api()
        .get(`/api/admin/financeiro/resumo?de=${de}&ate=${ate}`)
        .set('Authorization', admin)
        .expect(200);
      expect(r.body.vendas).toMatchObject({
        pedidos: 2,
        totalCentavos: 15000,
        comissaoCentavos: 1500,
        taxasCentavos: 150,
        repasseCentavos: 13350,
      });
      expect(r.body.porDia).toHaveLength(2);
      expect(r.body.porConta[0]).toMatchObject({ pedidos: 2, totalCentavos: 15000 });
      // saldo considera TODAS as vendas pagas (inclusive a antiga)
      expect(r.body.aRepassar).toMatchObject({ contas: 1, totalCentavos: 13350 + 17800 });
      await api()
        .get('/api/admin/financeiro/resumo?de=2026-02-01&ate=2026-01-01')
        .set('Authorization', admin)
        .expect(400);

      const saldos = await api()
        .get('/api/admin/financeiro/saldos')
        .set('Authorization', admin)
        .expect(200);
      expect(saldos.body[0]).toMatchObject({
        conta: { id },
        pedidosPagos: 3,
        vendidoCentavos: 35000,
        devidoCentavos: 31150,
        repassadoCentavos: 0,
        saldoCentavos: 31150,
        repassesAbertos: 0,
      });

      // gera parcial, tenta gerar outro (409), paga, gera o resto, marca falhou → saldo volta
      const parcial = await api()
        .post('/api/admin/repasses')
        .set('Authorization', admin)
        .send({ contaId: id, valorCentavos: 10000 })
        .expect(201);
      expect(parcial.body).toMatchObject({
        status: 'ABERTO',
        metodo: 'PIX_MANUAL',
        valorCentavos: 10000,
      });
      await api()
        .post('/api/admin/repasses')
        .set('Authorization', admin)
        .send({ contaId: id })
        .expect(409);
      await api()
        .patch(`/api/admin/repasses/${parcial.body.id}/pagar`)
        .set('Authorization', admin)
        .send({ referencia: 'E2E123' })
        .expect(200)
        .expect((x) =>
          expect(x.body).toMatchObject({ status: 'PAGO', provedorTransferenciaId: 'E2E123' }),
        );

      let s = await api()
        .get('/api/admin/financeiro/saldos')
        .set('Authorization', admin)
        .expect(200);
      expect(s.body[0]).toMatchObject({ repassadoCentavos: 10000, saldoCentavos: 21150 });

      await api()
        .post('/api/admin/repasses')
        .set('Authorization', admin)
        .send({ contaId: id, valorCentavos: 99999 })
        .expect(422);
      const resto = await api()
        .post('/api/admin/repasses')
        .set('Authorization', admin)
        .send({ contaId: id })
        .expect(201);
      expect(resto.body.valorCentavos).toBe(21150);
      await api()
        .patch(`/api/admin/repasses/${resto.body.id}/falhou`)
        .set('Authorization', admin)
        .send({ motivo: 'chave pix inválida' })
        .expect(200);
      s = await api().get('/api/admin/financeiro/saldos').set('Authorization', admin).expect(200);
      expect(s.body[0]).toMatchObject({ saldoCentavos: 21150, repassesAbertos: 0 });

      const lista = await api()
        .get('/api/admin/repasses?status=PAGO')
        .set('Authorization', admin)
        .expect(200);
      expect(lista.body.total).toBe(1);
      const acoes = (
        await prisma.auditoria.findMany({ where: { acao: { startsWith: 'repasse.' } } })
      )
        .map((a) => a.acao)
        .sort();
      expect(acoes).toEqual(['repasse.falhou', 'repasse.gerar', 'repasse.gerar', 'repasse.pagar']);
    });
  });

  describe('auditoria e sistema', () => {
    it('auditoria lista com rótulo, filtra por quem/ação/alvo/período e agrupa ações', async () => {
      const { id } = await cadastrarFotografo();
      const admin = await entrarAdmin();
      await api()
        .patch(`/api/admin/contas/${id}/status`)
        .set('Authorization', admin)
        .send({ status: 'SUSPENSA', motivo: 'teste' })
        .expect(200);

      const tudo = await api().get('/api/admin/auditoria').set('Authorization', admin).expect(200);
      expect(tudo.body.total).toBeGreaterThanOrEqual(2);
      const suspensao = tudo.body.itens.find((a: { acao: string }) => a.acao === 'conta.suspensa');
      expect(suspensao).toMatchObject({
        rotulo: 'Conta suspensa pelo admin — teste',
        alvoConta: { id, nome: FOTOGRAFO.nome },
        ator: { papel: 'ADMIN' },
      });

      const soAdmin = await api()
        .get('/api/admin/auditoria?ator=admin')
        .set('Authorization', admin)
        .expect(200);
      expect(
        soAdmin.body.itens.every((a: { ator: { papel: string } }) => a.ator.papel === 'ADMIN'),
      ).toBe(true);
      const sistema = await api()
        .get('/api/admin/auditoria?ator=sistema')
        .set('Authorization', admin)
        .expect(200);
      expect(sistema.body.itens.every((a: { ator: unknown }) => a.ator === null)).toBe(true);
      const prefixo = await api()
        .get('/api/admin/auditoria?acao=conta.')
        .set('Authorization', admin)
        .expect(200);
      expect(prefixo.body.itens.every((a: { acao: string }) => a.acao.startsWith('conta.'))).toBe(
        true,
      );
      const porAlvo = await api()
        .get(`/api/admin/auditoria?alvoTipo=conta&alvoId=${id}`)
        .set('Authorization', admin)
        .expect(200);
      expect(porAlvo.body.total).toBeGreaterThanOrEqual(2);
      const futuro = await api()
        .get('/api/admin/auditoria?de=2099-01-01')
        .set('Authorization', admin)
        .expect(200);
      expect(futuro.body.total).toBe(0);

      const acoes = await api()
        .get('/api/admin/auditoria/acoes')
        .set('Authorization', admin)
        .expect(200);
      expect(acoes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            acao: 'conta.suspensa',
            rotulo: 'Conta suspensa pelo admin',
            total: 1,
          }),
        ]),
      );
    });

    it('saúde geral, webhooks com erro (reprocessar volta pra fila) e lotes de sync', async () => {
      const { id } = await cadastrarFotografo();
      const admin = await entrarAdmin();
      const w = await prisma.webhookRecebido.create({
        data: {
          provedor: 'STRIPE',
          eventoRef: 'evt_1',
          tipo: 'invoice.paid',
          payload: { ok: 1 },
          erro: 'assinatura não encontrada',
        },
      });
      await prisma.webhookRecebido.create({
        data: {
          provedor: 'MERCADOPAGO',
          eventoRef: 'mp_1',
          tipo: 'payment',
          payload: {},
          processadoEm: new Date(),
        },
      });
      const token = await prisma.tokenApi
        .findFirstOrThrow({ where: { contaId: id } })
        .catch(async () => {
          await tokenDesktop();
          return prisma.tokenApi.findFirstOrThrow({ where: { contaId: id } });
        });
      await prisma.syncLote.create({
        data: {
          contaId: id,
          tokenApiId: token.id,
          tipo: 'PUBLICAR',
          chaveIdempotencia: 'lote-1',
          status: 'ERRO',
          totalItens: 10,
          itensOk: 7,
          itensErro: 3,
          erro: 'HEAD falhou em 3 chaves',
        },
      });

      const saude = await api()
        .get('/api/admin/sistema/saude')
        .set('Authorization', admin)
        .expect(200);
      expect(saude.body).toMatchObject({
        banco: 'ok',
        webhooks: { comErro: 1, pendentes: 0 },
        sync: { comErro: 1 },
      });

      const comErro = await api()
        .get('/api/admin/sistema/webhooks?situacao=erro')
        .set('Authorization', admin)
        .expect(200);
      expect(comErro.body.total).toBe(1);
      await api()
        .post(`/api/admin/sistema/webhooks/${w.id}/reprocessar`)
        .set('Authorization', admin)
        .expect(200);
      const pendentes = await api()
        .get('/api/admin/sistema/webhooks?situacao=pendente')
        .set('Authorization', admin)
        .expect(200);
      expect(pendentes.body.itens.map((x: { id: string }) => x.id)).toEqual([w.id]);
      expect(await prisma.auditoria.count({ where: { acao: 'webhook.reprocessar' } })).toBe(1);

      const lotes = await api()
        .get('/api/admin/sistema/sync?status=ERRO')
        .set('Authorization', admin)
        .expect(200);
      expect(lotes.body.itens[0]).toMatchObject({ tipo: 'PUBLICAR', itensErro: 3, conta: { id } });
    });
  });
});
