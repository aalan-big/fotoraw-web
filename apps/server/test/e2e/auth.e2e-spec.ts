import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService, type Email } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { COOKIE_REFRESH } from '../../src/modulos/auth/auth.controller.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

/** Captura os e-mails em vez de enviar — o token do link é lido daqui. */
class EmailFalso {
  enviados: Email[] = [];
  async enviar(email: Email) {
    this.enviados.push(email);
  }
  ultimoToken(): string {
    const ultimo = this.enviados.at(-1);
    const token = ultimo?.texto?.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    if (!token) throw new Error('nenhum e-mail com token capturado');
    return token;
  }
}

const CADASTRO = {
  nome: 'Estúdio Teste',
  email: 'Contato@EstudioTeste.com',
  senha: 'frase-longa-e-segura-2026',
  slug: 'estudio-teste',
};

function cookieRefresh(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const c = cookies?.find((v) => v.startsWith(`${COOKIE_REFRESH}=`));
  if (!c) throw new Error('cookie de refresh ausente');
  return c.split(';')[0]!;
}

describe('auth (e2e)', () => {
  let app: INestApplication;
  let emails: EmailFalso;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    emails = new EmailFalso();
    app = await criarApp((b) => b.overrideProvider(EmailService).useValue(emails));
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    emails.enviados = [];
  });

  afterAll(async () => {
    await app.close();
  });

  async function cadastrar(dados = CADASTRO) {
    return api().post('/api/auth/cadastro').send(dados).expect(201);
  }

  // ---------------------------------------------------------------------------

  describe('cadastro', () => {
    it('cria conta + perfil, normaliza e-mail, entra logado e manda verificação', async () => {
      const res = await cadastrar();
      expect(res.body.acesso).toEqual(expect.any(String));
      expect(res.body.conta).toMatchObject({
        email: 'contato@estudioteste.com',
        slug: 'estudio-teste',
        papel: 'FOTOGRAFO',
        emailVerificado: false,
      });
      expect(res.body.conta.senhaHash).toBeUndefined();
      expect(cookieRefresh(res)).toMatch(/^fr_sessao=/);
      expect(res.headers['set-cookie']![0]).toMatch(/HttpOnly/);

      const conta = await prisma.conta.findUniqueOrThrow({
        where: { email: 'contato@estudioteste.com' },
        include: { perfil: true },
      });
      expect(conta.senhaHash).toMatch(/^\$argon2id\$/);
      expect(conta.perfil?.nomeFantasia).toBe('Estúdio Teste');

      expect(emails.enviados).toHaveLength(1);
      expect(emails.enviados[0]!.para).toBe('contato@estudioteste.com');
      expect(emails.ultimoToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const auditoria = await prisma.auditoria.findMany({ where: { acao: 'conta.criada' } });
      expect(auditoria).toHaveLength(1);
    });

    it('recusa e-mail repetido, slug repetido, slug reservado e senha comum', async () => {
      await cadastrar();
      await api()
        .post('/api/auth/cadastro')
        .send({ ...CADASTRO, slug: 'outro-slug' })
        .expect(409)
        .expect((r) => expect(r.body.codigo).toBe('EMAIL_JA_CADASTRADO'));
      await api()
        .post('/api/auth/cadastro')
        .send({ ...CADASTRO, email: 'outro@x.com' })
        .expect(409)
        .expect((r) => expect(r.body.codigo).toBe('SLUG_JA_USADO'));
      await api()
        .post('/api/auth/cadastro')
        .send({ ...CADASTRO, email: 'outro@x.com', slug: 'admin' })
        .expect(409)
        .expect((r) => expect(r.body.codigo).toBe('SLUG_JA_USADO'));
      await api()
        .post('/api/auth/cadastro')
        .send({ ...CADASTRO, email: 'outro@x.com', slug: 'outro', senha: 'Senha123' })
        .expect(422)
        .expect((r) => expect(r.body.codigo).toBe('SENHA_FRACA'));
    });

    it('valida o corpo (senha curta, slug inválido)', async () => {
      const res = await api()
        .post('/api/auth/cadastro')
        .send({ ...CADASTRO, senha: '1234567', slug: 'A b' })
        .expect(400);
      const campos = res.body.erros.map((e: { campo: string }) => e.campo);
      expect(campos).toEqual(expect.arrayContaining(['senha', 'slug']));
    });
  });

  // ---------------------------------------------------------------------------

  describe('login e sessão', () => {
    it('login → refresh rotaciona → cookie antigo reutilizado derruba a família', async () => {
      await cadastrar();
      const login = await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: CADASTRO.senha })
        .expect(200);
      const cookie1 = cookieRefresh(login);

      const refresh = await api().post('/api/auth/refresh').set('Cookie', cookie1).expect(200);
      const cookie2 = cookieRefresh(refresh);
      expect(cookie2).not.toBe(cookie1);
      expect(refresh.body.acesso).toEqual(expect.any(String));

      // reuso do cookie já rotacionado = roubo
      await api()
        .post('/api/auth/refresh')
        .set('Cookie', cookie1)
        .expect(401)
        .expect((r) => expect(r.body.codigo).toBe('SESSAO_INVALIDA'));
      // e o cookie legítimo também morre
      await api().post('/api/auth/refresh').set('Cookie', cookie2).expect(401);

      const reuso = await prisma.auditoria.count({ where: { acao: 'sessao.reuso_detectado' } });
      expect(reuso).toBe(1);
    });

    it('sair revoga a sessão e limpa o cookie', async () => {
      const cad = await cadastrar();
      const cookie = cookieRefresh(cad);
      const sair = await api().post('/api/auth/sair').set('Cookie', cookie).expect(204);
      expect(sair.headers['set-cookie']![0]).toMatch(/fr_sessao=;/);
      await api().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('refresh sem cookie é 401', async () => {
      await api().post('/api/auth/refresh').expect(401);
    });

    it('e-mail inexistente e senha errada dão a mesma resposta', async () => {
      await cadastrar();
      const a = await api()
        .post('/api/auth/login')
        .send({ email: 'ninguem@x.com', senha: 'qualquer-coisa' })
        .expect(401);
      const b = await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: 'errada-errada' })
        .expect(401);
      expect(a.body.codigo).toBe('CREDENCIAIS_INVALIDAS');
      expect(b.body.codigo).toBe('CREDENCIAIS_INVALIDAS');
      expect(a.body.mensagem).toBe(b.body.mensagem);
    });

    it('bloqueia o e-mail após 5 falhas, mesmo com a senha certa', async () => {
      await cadastrar();
      for (let i = 0; i < 5; i += 1) {
        await api()
          .post('/api/auth/login')
          .send({ email: CADASTRO.email, senha: `errada-${i}` })
          .expect(401);
      }
      await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: CADASTRO.senha })
        .expect(429)
        .expect((r) => expect(r.body.codigo).toBe('MUITAS_TENTATIVAS'));
      // outro e-mail não é afetado
      await api().post('/api/auth/login').send({ email: 'outro@x.com', senha: 'x' }).expect(401);
    });

    it('conta bloqueada não entra', async () => {
      await cadastrar();
      await prisma.conta.updateMany({ data: { status: 'BLOQUEADA' } });
      await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: CADASTRO.senha })
        .expect(403)
        .expect((r) => expect(r.body.codigo).toBe('CONTA_BLOQUEADA'));
    });
  });

  // ---------------------------------------------------------------------------

  describe('desktop (POST /auth/dispositivo)', () => {
    const maquina = {
      email: CADASTRO.email,
      senha: CADASTRO.senha,
      fingerprint: 'fp-notebook-0001',
      nomeMaquina: 'Notebook do estúdio',
      versaoApp: '1.4.0',
    };

    it('vincula a máquina, devolve token_api opaco e guarda só o hash', async () => {
      await cadastrar();
      const res = await api().post('/api/auth/dispositivo').send(maquina).expect(200);
      expect(res.body.tokenApi).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.body.conta.slug).toBe('estudio-teste');
      expect(res.body.dispositivo.nome).toBe('Notebook do estúdio');
      expect(res.headers['set-cookie']).toBeUndefined();

      const tokens = await prisma.tokenApi.findMany();
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tokenHash).not.toBe(res.body.tokenApi);
      expect(tokens[0]!.dispositivoId).not.toBeNull();
      expect(tokens[0]!.expiraEm!.getTime()).toBeGreaterThan(Date.now() + 300 * 24 * 3600 * 1000);
    });

    it('novo login na mesma máquina troca o token e não duplica o dispositivo', async () => {
      await cadastrar();
      const a = await api().post('/api/auth/dispositivo').send(maquina).expect(200);
      const b = await api().post('/api/auth/dispositivo').send(maquina).expect(200);
      expect(a.body.tokenApi).not.toBe(b.body.tokenApi);
      expect(await prisma.dispositivo.count()).toBe(1);
      const ativos = await prisma.tokenApi.count({ where: { revogadoEm: null } });
      expect(ativos).toBe(1);
    });

    it('respeita o limite de máquinas da licença ativa', async () => {
      const cad = await cadastrar();
      await prisma.licenca.create({
        data: {
          contaId: cad.body.conta.id,
          chave: 'FR-TEST-0000-0001',
          tipo: 'TRIAL',
          recursos: { limite_dispositivos: 1 },
        },
      });
      await api().post('/api/auth/dispositivo').send(maquina).expect(200);
      await api()
        .post('/api/auth/dispositivo')
        .send({ ...maquina, fingerprint: 'fp-outra-maquina', nomeMaquina: 'PC da recepção' })
        .expect(403)
        .expect((r) => expect(r.body.codigo).toBe('LIMITE_DISPOSITIVOS'));
      // a mesma máquina continua entrando
      await api().post('/api/auth/dispositivo').send(maquina).expect(200);
    });
  });

  // ---------------------------------------------------------------------------

  describe('verificação de e-mail', () => {
    it('link do e-mail marca a conta como verificada; segundo uso falha', async () => {
      await cadastrar();
      const token = emails.ultimoToken();
      const res = await api().post('/api/auth/verificar-email').send({ token }).expect(200);
      expect(res.body.emailVerificado).toBe(true);
      await api()
        .post('/api/auth/verificar-email')
        .send({ token })
        .expect(422)
        .expect((r) => expect(r.body.codigo).toBe('TOKEN_INVALIDO'));
    });

    it('reenviar invalida o token anterior; responde 204 mesmo pra e-mail desconhecido', async () => {
      await cadastrar();
      const antigo = emails.ultimoToken();
      await api()
        .post('/api/auth/reenviar-verificacao')
        .send({ email: CADASTRO.email })
        .expect(204);
      const novo = emails.ultimoToken();
      expect(novo).not.toBe(antigo);
      await api().post('/api/auth/verificar-email').send({ token: antigo }).expect(422);
      await api().post('/api/auth/verificar-email').send({ token: novo }).expect(200);

      const antes = emails.enviados.length;
      await api()
        .post('/api/auth/reenviar-verificacao')
        .send({ email: 'nao@existe.com' })
        .expect(204);
      expect(emails.enviados).toHaveLength(antes);
    });
  });

  // ---------------------------------------------------------------------------

  describe('recuperar e redefinir senha', () => {
    it('fluxo completo: pede link → redefine → sessões web e tokens do desktop caem', async () => {
      const cad = await cadastrar();
      const cookieWeb = cookieRefresh(cad);
      await api()
        .post('/api/auth/dispositivo')
        .send({
          email: CADASTRO.email,
          senha: CADASTRO.senha,
          fingerprint: 'fp-notebook-0001',
          nomeMaquina: 'Notebook',
        })
        .expect(200);

      await api().post('/api/auth/recuperar-senha').send({ email: CADASTRO.email }).expect(204);
      const token = emails.ultimoToken();
      await api()
        .post('/api/auth/redefinir-senha')
        .send({ token, senha: 'outra-frase-segura-2026' })
        .expect(204);

      // senha antiga não entra mais, nova entra
      await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: CADASTRO.senha })
        .expect(401);
      await api()
        .post('/api/auth/login')
        .send({ email: CADASTRO.email, senha: 'outra-frase-segura-2026' })
        .expect(200);

      // tudo que existia antes foi revogado
      await api().post('/api/auth/refresh').set('Cookie', cookieWeb).expect(401);
      expect(await prisma.tokenApi.count({ where: { revogadoEm: null } })).toBe(0);
      // token de uso único
      await api()
        .post('/api/auth/redefinir-senha')
        .send({ token, senha: 'mais-uma-frase-2026' })
        .expect(422);
    });

    it('recuperar senha de e-mail desconhecido responde 204 sem mandar e-mail', async () => {
      await api().post('/api/auth/recuperar-senha').send({ email: 'x@y.com' }).expect(204);
      expect(emails.enviados).toHaveLength(0);
    });
  });
});
