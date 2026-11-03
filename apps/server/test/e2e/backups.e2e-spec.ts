import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { StorageService } from '../../src/infra/storage/storage.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const SENHA = 'senha-segura-e2e-2026';
const SHA = 'a'.repeat(64);

describe('backups do desktop (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // bucket simulado: chave → tamanho em bytes
  const bucket = new Map<string, number>();
  const removidos: string[] = [];
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp((b) =>
      b.overrideProvider(EmailService).useValue({ enviar: async () => {} }),
    );
    prisma = app.get(PrismaService);
    const storage = app.get(StorageService);
    vi.spyOn(storage, 'gerarUrlUpload').mockImplementation(async (_b, chave) => `upload:${chave}`);
    vi.spyOn(storage, 'obterTamanhoObjetoBytes').mockImplementation(
      async (_b, chave) => bucket.get(chave) ?? null,
    );
    vi.spyOn(storage, 'removerObjetos').mockImplementation(async (_b, chaves) => {
      removidos.push(...chaves);
      for (const c of chaves) bucket.delete(c);
      return chaves.length;
    });
    vi.spyOn(storage, 'gerarUrlDownloadAssinada').mockImplementation(
      async (_b, chave) => `assinada:${chave}`,
    );
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    bucket.clear();
    removidos.length = 0;
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

  /** cadastra, conecta um desktop e devolve os dois tokens */
  async function fotografo(slug: string) {
    const email = `${slug}@fotoraw.local`;
    const cad = await api()
      .post('/api/auth/cadastro')
      .send({ nome: slug, email, senha: SENHA, slug })
      .expect(201);
    const disp = await api()
      .post('/api/auth/dispositivo')
      .send({ email, senha: SENHA, fingerprint: `fp-${slug}`, nomeMaquina: 'PC do estúdio' })
      .expect(200);
    const conta = await prisma.conta.findUniqueOrThrow({ where: { email } });
    return {
      web: cad.body.acesso as string,
      desktop: disp.body.tokenApi as string,
      contaId: conta.id,
    };
  }

  it('desktop manda, confere o arquivo, lista e baixa; o painel vê; outra conta não', async () => {
    const f = await fotografo('backup-um');
    const desk = (r: request.Test) => r.set('Authorization', `Bearer ${f.desktop}`);

    // tamanho acima do limite: recusado antes de gerar link
    await desk(api().post('/api/sync/backups'))
      .send({ tamanhoBytes: 2 * 1024 ** 3, sha256: SHA })
      .expect(400);

    const ini = await desk(api().post('/api/sync/backups'))
      .send({
        tamanhoBytes: 1000,
        sha256: SHA.toUpperCase(),
        versaoApp: '0.5.0',
        resumo: { ensaios: 3, clientes: 12 },
      })
      .expect(201);
    const reg = await prisma.backupDesktop.findUniqueOrThrow({ where: { id: ini.body.id } });
    expect(reg.chave).toMatch(
      new RegExp(`^backups/${f.contaId}/\\d{4}-\\d{2}-\\d{2}_${reg.id}\\.fotoraw-backup$`),
    );
    expect(ini.body.urlUpload).toBe(`upload:${reg.chave}`);
    expect(reg.status).toBe('ENVIANDO');

    // ainda não subiu / subiu pela metade
    const semArquivo = await desk(api().post(`/api/sync/backups/${reg.id}/confirmar`)).expect(422);
    expect(semArquivo.body.codigo).toBe('BACKUP_NAO_ENVIADO');
    bucket.set(reg.chave, 500);
    const metade = await desk(api().post(`/api/sync/backups/${reg.id}/confirmar`)).expect(422);
    expect(metade.body.codigo).toBe('BACKUP_INCOMPLETO');

    // enquanto não confirma, não aparece na lista
    expect((await desk(api().get('/api/sync/backups')).expect(200)).body.backups).toEqual([]);

    bucket.set(reg.chave, 1000);
    const ok = await desk(api().post(`/api/sync/backups/${reg.id}/confirmar`)).expect(200);
    expect(ok.body).toMatchObject({
      id: reg.id,
      tamanhoBytes: 1000,
      sha256: SHA,
      versaoApp: '0.5.0',
      resumo: { ensaios: 3, clientes: 12 },
      computador: 'PC do estúdio',
    });
    // confirmar de novo não faz mal
    await desk(api().post(`/api/sync/backups/${reg.id}/confirmar`)).expect(200);

    const lista = await desk(api().get('/api/sync/backups')).expect(200);
    expect(lista.body.backups.map((b: { id: string }) => b.id)).toEqual([reg.id]);

    const link = await desk(api().get(`/api/sync/backups/${reg.id}/arquivo`)).expect(200);
    expect(link.body).toMatchObject({
      url: `assinada:${reg.chave}`,
      tamanhoBytes: 1000,
      sha256: SHA,
    });

    // painel do fotógrafo
    const painel = await api()
      .get('/api/me/backups')
      .set('Authorization', `Bearer ${f.web}`)
      .expect(200);
    expect(painel.body.backups).toHaveLength(1);
    await api()
      .get(`/api/me/backups/${reg.id}/arquivo`)
      .set('Authorization', `Bearer ${f.web}`)
      .expect(200);

    // outra conta não enxerga nem baixa
    const outro = await fotografo('backup-dois');
    expect(
      (
        await api()
          .get('/api/sync/backups')
          .set('Authorization', `Bearer ${outro.desktop}`)
          .expect(200)
      ).body.backups,
    ).toEqual([]);
    await api()
      .get(`/api/sync/backups/${reg.id}/arquivo`)
      .set('Authorization', `Bearer ${outro.desktop}`)
      .expect(404);
    await api()
      .post(`/api/sync/backups/${reg.id}/confirmar`)
      .set('Authorization', `Bearer ${outro.desktop}`)
      .expect(404);
  });

  it('ao confirmar um novo, apaga os antigos fora da retenção e os uploads abandonados', async () => {
    const f = await fotografo('backup-retencao');
    const desk = (r: request.Test) => r.set('Authorization', `Bearer ${f.desktop}`);
    const DIA = 24 * 60 * 60 * 1000;

    // 40 dias de backups antigos (um por dia, ao meio-dia de Brasília) + um upload que nunca terminou
    const antigos = Array.from({ length: 40 }, (_, i) => {
      const em = new Date(Date.now() - (i + 1) * DIA);
      return {
        contaId: f.contaId,
        chave: `backups/${f.contaId}/antigo-${i}.fotoraw-backup`,
        tamanhoBytes: 10,
        sha256: SHA,
        status: 'CONCLUIDO' as const,
        criadoEm: em,
        concluidoEm: em,
      };
    });
    await prisma.backupDesktop.createMany({
      data: [
        ...antigos,
        {
          contaId: f.contaId,
          chave: `backups/${f.contaId}/abandonado.fotoraw-backup`,
          tamanhoBytes: 10,
          sha256: SHA,
          criadoEm: new Date(Date.now() - 3 * DIA),
        },
      ],
    });

    const ini = await desk(api().post('/api/sync/backups'))
      .send({ tamanhoBytes: 20, sha256: SHA })
      .expect(201);
    expect(removidos).toEqual([`backups/${f.contaId}/abandonado.fotoraw-backup`]);
    const reg = await prisma.backupDesktop.findUniqueOrThrow({ where: { id: ini.body.id } });
    bucket.set(reg.chave, 20);
    await desk(api().post(`/api/sync/backups/${reg.id}/confirmar`)).expect(200);

    const lista = (await desk(api().get('/api/sync/backups')).expect(200)).body.backups as {
      id: string;
    }[];
    // 7 dias (hoje + 6 antigos) + até 3 semanas anteriores além da atual
    expect(lista.length).toBeGreaterThanOrEqual(8);
    expect(lista.length).toBeLessThanOrEqual(10);
    expect(lista[0]!.id).toBe(reg.id);
    expect(await prisma.backupDesktop.count({ where: { contaId: f.contaId } })).toBe(lista.length);
    // o que saiu do banco saiu do bucket também
    expect(removidos.length).toBe(1 + 40 + 1 - lista.length);
  });
});
