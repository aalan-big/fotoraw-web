import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService, type Email } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const CADASTRO = {
  nome: 'Estúdio Teste',
  email: 'contato@estudioteste.com',
  senha: 'frase-longa-e-segura-2026',
  slug: 'estudio-teste',
};

const MAQUINA = {
  email: CADASTRO.email,
  senha: CADASTRO.senha,
  fingerprint: 'fp-notebook-0001',
  nomeMaquina: 'Notebook do estúdio',
};

describe('contas e licencas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: Email[] = [];
  const api = () => request(app.getHttpServer());

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
    // os e2e truncam tudo — repõe o que a migration 5/7 semeou e o service precisa
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
          ordem: 1,
        },
        {
          codigo: 'pro_mensal',
          nome: 'PRO mensal',
          precoCentavos: 4990,
          periodicidade: 'MENSAL',
          comissaoEventoPct: 10,
          limiteArmazenamentoMb: 204800,
          limiteDispositivos: 3,
          permiteGaleriaPrivada: true,
          ordem: 2,
        },
      ],
    });
    await prisma.configuracaoPlataforma.create({ data: { chave: 'trial_dias', valor: 14 } });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Cadastra e devolve o Bearer. */
  async function entrar(): Promise<string> {
    const res = await api().post('/api/auth/cadastro').send(CADASTRO).expect(201);
    return `Bearer ${res.body.acesso}`;
  }

  // ---------------------------------------------------------------------------

  describe('GET /me', () => {
    it('exige JWT', async () => {
      await api().get('/api/me').expect(401);
      await api().get('/api/me').set('Authorization', 'Bearer lixo').expect(401);
    });

    it('devolve conta, perfil, licença trial e pendências', async () => {
      const auth = await entrar();
      const res = await api().get('/api/me').set('Authorization', auth).expect(200);
      expect(res.body.conta).toMatchObject({ slug: 'estudio-teste', emailVerificado: false });
      expect(res.body.perfil).toMatchObject({ nomeFantasia: 'Estúdio Teste' });
      expect(res.body.licenca).toMatchObject({
        plano: 'trial',
        tipo: 'TRIAL',
        recursos: { limite_dispositivos: 3, permite_galeria_privada: true },
      });
      expect(res.body.licenca.chave).toMatch(/^FR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(res.body.licenca.diasRestantes).toBe(14);
      expect(res.body.pendencias).toEqual(['verificar_email', 'completar_perfil']);
    });

    it('trial vencido vira EXPIRADA e a conta cai no gratuito', async () => {
      const auth = await entrar();
      await prisma.licenca.updateMany({ data: { validaAte: new Date(Date.now() - 1000) } });
      const res = await api().get('/api/me').set('Authorization', auth).expect(200);
      expect(res.body.licenca).toMatchObject({
        plano: 'gratuito',
        chave: null,
        recursos: { limite_dispositivos: 1, permite_galeria_privada: false },
      });
      expect(await prisma.licenca.count({ where: { status: 'EXPIRADA' } })).toBe(1);
    });
  });

  describe('PATCH /me e PUT /me/senha', () => {
    it('nome muda na hora; e-mail novo fica pendente até confirmar pelo link', async () => {
      const auth = await entrar();
      const res = await api()
        .patch('/api/me')
        .set('Authorization', auth)
        .send({ nome: 'Estúdio Novo', email: 'Novo@EstudioTeste.com' })
        .expect(200);
      expect(res.body.conta.nome).toBe('Estúdio Novo');
      expect(res.body.conta.email).toBe(CADASTRO.email);
      expect(res.body.emailPendente).toBe('novo@estudioteste.com');

      const email = emails.at(-1)!;
      expect(email.para).toBe('novo@estudioteste.com');
      const token = email.texto!.match(/token=([A-Za-z0-9_-]+)/)![1];
      const conf = await api().post('/api/auth/confirmar-email').send({ token }).expect(200);
      expect(conf.body).toMatchObject({ email: 'novo@estudioteste.com', emailVerificado: true });
    });

    it('trocar senha exige a atual, derruba a sessão antiga e devolve uma nova', async () => {
      const auth = await entrar();
      await api()
        .put('/api/me/senha')
        .set('Authorization', auth)
        .send({ senhaAtual: 'errada-errada', novaSenha: 'outra-frase-segura-2026' })
        .expect(401);
      const res = await api()
        .put('/api/me/senha')
        .set('Authorization', auth)
        .send({ senhaAtual: CADASTRO.senha, novaSenha: 'outra-frase-segura-2026' })
        .expect(200);
      expect(res.body.acesso).toEqual(expect.any(String));
      expect(res.headers['set-cookie']![0]).toMatch(/^fr_sessao=/);
      // sessões web antigas revogadas (a nova é a única viva)
      const vivas = await prisma.sessaoWeb.count({ where: { revogadaEm: null } });
      expect(vivas).toBe(1);
      await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: 'outra-frase-segura-2026' })
        .expect(200);
    });
  });

  describe('perfil', () => {
    it('salva, normaliza (whatsapp/cpf só dígitos, @ do instagram) e tira pendência', async () => {
      const auth = await entrar();
      const res = await api()
        .put('/api/me/perfil')
        .set('Authorization', auth)
        .send({
          bio: 'Fotografia de corrida',
          whatsapp: '(41) 99999-1234',
          instagram: '@estudio.teste',
          cidade: 'Curitiba',
          uf: 'pr',
          cnpjCpf: '123.456.789-09',
          taxasParaCliente: true,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        nomeFantasia: 'Estúdio Teste',
        whatsapp: '41999991234',
        instagram: 'estudio.teste',
        uf: 'PR',
        cnpjCpf: '12345678909',
        taxasParaCliente: true,
      });
      const me = await api().get('/api/me').set('Authorization', auth).expect(200);
      expect(me.body.pendencias).toEqual(['verificar_email']);
      expect(await prisma.auditoria.count({ where: { acao: 'perfil.taxas_para_cliente' } })).toBe(
        1,
      );
    });

    it('rejeita whatsapp/cpf inválidos', async () => {
      const auth = await entrar();
      const res = await api()
        .put('/api/me/perfil')
        .set('Authorization', auth)
        .send({ whatsapp: '123', cnpjCpf: '12' })
        .expect(400);
      const campos = res.body.erros.map((e: { campo: string }) => e.campo);
      expect(campos).toEqual(expect.arrayContaining(['whatsapp', 'cnpjCpf']));
    });
  });

  describe('dispositivos', () => {
    it('lista as máquinas; revogar mata o token e libera a vaga na licença', async () => {
      const auth = await entrar();
      // trial permite 3; aperta pra 1 pra testar a vaga
      await prisma.licenca.updateMany({ data: { recursos: { limite_dispositivos: 1 } } });

      const desktop = await api().post('/api/auth/dispositivo').send(MAQUINA).expect(200);
      const tokenApi = `Bearer ${desktop.body.tokenApi}`;

      let lista = await api().get('/api/me/dispositivos').set('Authorization', auth).expect(200);
      expect(lista.body).toHaveLength(1);
      expect(lista.body[0]).toMatchObject({ nome: 'Notebook do estúdio', conectado: true });

      // segunda máquina não cabe
      await api()
        .post('/api/auth/dispositivo')
        .send({ ...MAQUINA, fingerprint: 'fp-pc-recepcao', nomeMaquina: 'PC da recepção' })
        .expect(403);

      // o desktop consegue usar o token
      await api().get('/api/licencas/atual').set('Authorization', tokenApi).expect(200);

      await api()
        .delete(`/api/me/dispositivos/${lista.body[0].id}`)
        .set('Authorization', auth)
        .expect(204);

      // token morreu, vaga liberou
      await api().get('/api/licencas/atual').set('Authorization', tokenApi).expect(401);
      lista = await api().get('/api/me/dispositivos').set('Authorization', auth).expect(200);
      expect(lista.body[0].conectado).toBe(false);
      await api()
        .post('/api/auth/dispositivo')
        .send({ ...MAQUINA, fingerprint: 'fp-pc-recepcao', nomeMaquina: 'PC da recepção' })
        .expect(200);
    });

    it('não revoga dispositivo de outra conta', async () => {
      const auth = await entrar();
      await api()
        .delete('/api/me/dispositivos/01999999-0000-7000-8000-000000000000')
        .set('Authorization', auth)
        .expect(404);
    });
  });

  describe('GET /licencas/atual (desktop)', () => {
    it('exige token_api (JWT da web não serve) e devolve os recursos', async () => {
      const auth = await entrar();
      await api().get('/api/licencas/atual').set('Authorization', auth).expect(401);
      const desktop = await api().post('/api/auth/dispositivo').send(MAQUINA).expect(200);
      const res = await api()
        .get('/api/licencas/atual')
        .set('Authorization', `Bearer ${desktop.body.tokenApi}`)
        .expect(200);
      expect(res.body).toMatchObject({ plano: 'trial', recursos: { limite_dispositivos: 3 } });
      const token = await prisma.tokenApi.findFirstOrThrow();
      expect(token.ultimoUsoEm).not.toBeNull();
    });
  });

  describe('excluir conta', () => {
    it('pede a senha, derruba tudo, anonimiza o e-mail e permite cadastrar de novo', async () => {
      const auth = await entrar();
      await api().post('/api/auth/dispositivo').send(MAQUINA).expect(200);
      await api()
        .post('/api/me/excluir')
        .set('Authorization', auth)
        .send({ senha: 'errada-errada' })
        .expect(401);
      await api()
        .post('/api/me/excluir')
        .set('Authorization', auth)
        .send({ senha: CADASTRO.senha })
        .expect(204);

      await api().get('/api/me').set('Authorization', auth).expect(401);
      await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: CADASTRO.senha })
        .expect(401);
      expect(await prisma.tokenApi.count({ where: { revogadoEm: null } })).toBe(0);

      // mesmo e-mail cadastra de novo (slug precisa ser outro)
      await api()
        .post('/api/auth/cadastro')
        .send({ ...CADASTRO, slug: 'estudio-teste-2' })
        .expect(201);
    });
  });
});
