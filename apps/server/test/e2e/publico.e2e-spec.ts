import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { PublicoService } from '../../src/modulos/publico/publico.service.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Estúdio Luz',
  email: 'luz-vitrine@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'estudio-luz',
};

describe('vitrine: galeria pública (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let contaId: string;
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
    app.get(PublicoService).tentativasCodigo.reiniciar();
    await prisma.plano.create({
      data: {
        codigo: 'gratuito',
        nome: 'Gratuito',
        precoCentavos: 0,
        periodicidade: 'NENHUMA',
        comissaoEventoPct: 10,
        limiteDispositivos: 1,
        permiteEvento: true,
        ordem: 1,
      },
    });
    const cad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    contaId = cad.body.conta.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function criarGaleria(dados: Record<string, unknown>, fotos = 3) {
    const galeria = await prisma.galeria.create({
      data: {
        contaId,
        ensaioIdDesktop: `ensaio-${dados.slug}`,
        titulo: 'Galeria',
        modalidade: 'EVENTO',
        visibilidade: 'PUBLICA',
        modoVenda: 'AVULSO',
        precoFotoCentavos: 1500,
        status: 'PUBLICADA',
        publicadaEm: new Date(),
        totalFotos: fotos,
        slug: 'galeria',
        ...dados,
      },
    });
    for (let i = 0; i < fotos; i++) {
      await prisma.foto.create({
        data: {
          galeriaId: galeria.id,
          fotoIdDesktop: `f${i}`,
          previewKey: `previews/${contaId}/${galeria.id}/f${i}.webp`,
          altaKey: `originais/${contaId}/${galeria.id}/f${i}.jpg`,
          numeroIdentificacao: i === 1 ? '142' : String(200 + i),
          precoCentavos: i === 2 ? 2500 : null,
          ordem: fotos - i, // ordem do desktop invertida de propósito
        },
      });
    }
    return galeria;
  }

  it('evento público abre com as prévias na ordem, preço por foto e busca por número', async () => {
    await criarGaleria({ slug: 'corrida-10k', titulo: 'Corrida 10k' });

    const res = await api().get('/api/publico/galerias/estudio-luz/corrida-10k').expect(200);
    expect(res.body).toMatchObject({
      titulo: 'Corrida 10k',
      situacao: 'ABERTA',
      podeComprar: true,
      precoFotoCentavos: 1500,
      fotografo: { nome: 'Estúdio Luz', slug: 'estudio-luz' },
      fotos: { total: 3, pagina: 1 },
    });
    // ordem = a do desktop; preço da foto sobrescreve o da galeria
    expect(res.body.fotos.itens.map((f: { numero: string }) => f.numero)).toEqual(['202', '142', '200']);
    expect(res.body.fotos.itens[0].precoCentavos).toBe(2500);
    expect(res.body.fotos.itens[1].precoCentavos).toBe(1500);
    expect(res.body.fotos.itens[0].url).toMatch(/\/previews\/.+\/f2\.webp$/);
    // nada do original vaza pra vitrine
    expect(JSON.stringify(res.body)).not.toContain('originais/');
    expect(JSON.stringify(res.body)).not.toContain('codigoAcesso');

    const busca = await api()
      .get('/api/publico/galerias/estudio-luz/corrida-10k')
      .query({ numero: '142' })
      .expect(200);
    expect(busca.body.fotos.total).toBe(1);
    expect(busca.body.fotos.itens[0].numero).toBe('142');
  });

  it('rascunho, slug errado e conta errada são 404', async () => {
    await criarGaleria({ slug: 'rascunho', status: 'RASCUNHO' });
    await api().get('/api/publico/galerias/estudio-luz/rascunho').expect(404);
    await api().get('/api/publico/galerias/estudio-luz/nao-existe').expect(404);
    await criarGaleria({ slug: 'certa' });
    await api().get('/api/publico/galerias/outro-fotografo/certa').expect(404);
  });

  it('pausada mostra sem vender; encerrada não mostra fotos', async () => {
    await criarGaleria({ slug: 'pausada', status: 'PAUSADA' });
    const pausada = await api().get('/api/publico/galerias/estudio-luz/pausada').expect(200);
    expect(pausada.body).toMatchObject({ situacao: 'PAUSADA', podeComprar: false, fotos: { total: 3 } });

    await criarGaleria({ slug: 'vencida', encerraEm: new Date(Date.now() - 60_000) });
    const vencida = await api().get('/api/publico/galerias/estudio-luz/vencida').expect(200);
    expect(vencida.body).toMatchObject({ situacao: 'ENCERRADA', podeComprar: false, fotos: { total: 0, itens: [] } });
  });

  it('privada exige o código (pelo link ou pela página /ensaio) e entrega não vende', async () => {
    await criarGaleria({
      slug: 'entrega-maria',
      modalidade: 'ENSAIO_INTERNO',
      visibilidade: 'PRIVADA',
      modoVenda: 'ENTREGA',
      precoFotoCentavos: null,
      codigoAcesso: 'LUZ-4821',
    });
    const url = '/api/publico/galerias/estudio-luz/entrega-maria';

    const sem = await api().get(url).expect(403);
    expect(sem.body.codigo).toBe('CODIGO_NECESSARIO');
    const errado = await api().get(url).query({ codigo: 'LUZ-0000' }).expect(403);
    expect(errado.body.codigo).toBe('CODIGO_INVALIDO');

    const certo = await api().get(url).query({ codigo: 'luz-4821' }).expect(200);
    expect(certo.body).toMatchObject({ visibilidade: 'PRIVADA', podeComprar: false, fotos: { total: 3 } });

    const acesso = await api().post('/api/publico/acesso').send({ codigo: ' luz-4821 ' }).expect(200);
    expect(acesso.body).toEqual({ contaSlug: 'estudio-luz', galeriaSlug: 'entrega-maria', codigo: 'LUZ-4821' });
    await api().post('/api/publico/acesso').send({ codigo: 'NADA-1234' }).expect(404);
  });

  it('código errado demais bloqueia o IP por 15 minutos', async () => {
    await criarGaleria({ slug: 'privada', visibilidade: 'PRIVADA', codigoAcesso: 'LUZ-1111' });
    for (let i = 0; i < 10; i++) {
      await api().post('/api/publico/acesso').send({ codigo: `LUZ-${2000 + i}` }).expect(404);
    }
    const bloqueado = await api().post('/api/publico/acesso').send({ codigo: 'LUZ-1111' }).expect(429);
    expect(bloqueado.body.codigo).toBe('MUITAS_TENTATIVAS');
    await api()
      .get('/api/publico/galerias/estudio-luz/privada')
      .query({ codigo: 'LUZ-1111' })
      .expect(429);
  });

  it('senha definida pelo fotógrafo vai no header', async () => {
    const { SenhaService } = await import('../../src/modulos/auth/senha/senha.service.js');
    const senhaHash = await app.get(SenhaService).hash('segredo');
    await criarGaleria({ slug: 'com-senha', visibilidade: 'PRIVADA', codigoAcesso: 'LUZ-2222', senhaHash });
    const url = '/api/publico/galerias/estudio-luz/com-senha';

    const sem = await api().get(url).query({ codigo: 'LUZ-2222' }).expect(403);
    expect(sem.body.codigo).toBe('SENHA_NECESSARIA');
    await api().get(url).query({ codigo: 'LUZ-2222' }).set('x-senha-galeria', 'errada').expect(403);
    await api().get(url).query({ codigo: 'LUZ-2222' }).set('x-senha-galeria', 'segredo').expect(200);
  });

  it('perfil do fotógrafo lista só o que está na vitrine', async () => {
    await criarGaleria({ slug: 'aberta', titulo: 'Corrida Aberta' });
    await criarGaleria({ slug: 'fechada', visibilidade: 'PRIVADA', codigoAcesso: 'LUZ-3333' });
    await criarGaleria({ slug: 'rascunho', status: 'RASCUNHO' });

    const res = await api().get('/api/publico/fotografos/estudio-luz').expect(200);
    expect(res.body).toMatchObject({ nome: 'Estúdio Luz', slug: 'estudio-luz' });
    expect(res.body.galerias.map((g: { slug: string }) => g.slug)).toEqual(['aberta']);
    await api().get('/api/publico/fotografos/ninguem').expect(404);
  });
});
