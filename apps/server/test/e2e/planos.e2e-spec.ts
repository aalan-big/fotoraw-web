import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Fotógrafo Plano E2E',
  email: 'fotografo.plano@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'fotografo-plano-e2e',
};

describe('planos e assinaturas do fotógrafo (e2e)', () => {
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

    // Cria os planos padrão
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
          nome: 'PRO mensal',
          precoCentavos: 4990,
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
        {
          codigo: 'pro_anual',
          nome: 'PRO anual',
          precoCentavos: 49900,
          periodicidade: 'ANUAL',
          comissaoEventoPct: 10,
          limiteGaleriasAtivas: null,
          limiteFotosPorGaleria: null,
          limiteArmazenamentoMb: 204800,
          limiteDispositivos: 3,
          permiteEvento: true,
          permiteEnsaio: true,
          permiteGaleriaPrivada: true,
          permiteGestaoEstudio: true,
          ordem: 3,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('fluxo completo de planos: catálogo, status inicial em trial, contratação PRO, cancelamento no fim e reativação', async () => {
    // 1. Cadastra fotógrafo
    const resCad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    const token = resCad.body.acesso;

    // 2. Consulta catálogo de planos
    const resCatalogo = await api()
      .get('/api/planos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resCatalogo.body).toHaveLength(3);
    expect(resCatalogo.body[0].codigo).toBe('gratuito');
    expect(resCatalogo.body[1].codigo).toBe('pro_mensal');
    expect(resCatalogo.body[2].codigo).toBe('pro_anual');

    // 3. Consulta status atual do fotógrafo (Trial no cadastro)
    const resStatusInicial = await api()
      .get('/api/planos/meu-status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resStatusInicial.body.licenca.plano).toBe('trial');
    // a licença diz de qual plano veio (o cabeçalho do painel mostra o nome)
    expect(resStatusInicial.body.licenca.planoCodigo).toBe('pro_mensal');
    expect(resStatusInicial.body.licenca.planoNome).toBe('PRO mensal');
    expect(resStatusInicial.body.licenca.diasRestantes).toBeGreaterThanOrEqual(13);
    expect(resStatusInicial.body.assinatura).toBeNull();
    expect(resStatusInicial.body.faturas).toHaveLength(0);

    // 4. Assina o plano PRO Mensal
    const resAssinar = await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_mensal' })
      .expect(200);

    expect(resAssinar.body.assinatura).toBeDefined();
    expect(resAssinar.body.assinatura.planoCodigo).toBe('pro_mensal');
    expect(resAssinar.body.assinatura.precoCentavos).toBe(4990);
    expect(resAssinar.body.assinatura.cancelaNoFimDoPeriodo).toBe(false);

    // Sem pagamento, nada de PRO: a licença segue a do trial e a assinatura aguarda o pagamento
    expect(resAssinar.body.assinatura.aguardandoPagamento).toBe(true);
    expect(resAssinar.body.licenca.plano).toBe('trial');
    expect(resAssinar.body.licenca.tipo).toBe('TRIAL');

    // Fatura: 1 PENDENTE (a do 1º período), nenhuma PAGA
    expect(resAssinar.body.faturas).toHaveLength(1);
    expect(resAssinar.body.faturas[0].status).toBe('PENDENTE');
    expect(resAssinar.body.faturas[0].valorCentavos).toBe(4990);

    // Clicar de novo no mesmo plano não duplica o pedido
    const resRepetido = await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_mensal' })
      .expect(200);
    expect(resRepetido.body.assinatura.id).toBe(resAssinar.body.assinatura.id);
    expect(resRepetido.body.faturas).toHaveLength(1);

    // 5. Cancela assinatura no fim do período
    const resCancelar = await api()
      .post('/api/planos/cancelar')
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Troca temporária de equipamento' })
      .expect(200);

    expect(resCancelar.body.assinatura.cancelaNoFimDoPeriodo).toBe(true);
    expect(resCancelar.body.assinatura.status).toBe('ATIVA'); // Continua ativa até o fim do período!
    expect(resCancelar.body.licenca.status).toBe('ATIVA');

    // 6. Reativa assinatura
    const resReativar = await api()
      .post('/api/planos/reativar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resReativar.body.assinatura.cancelaNoFimDoPeriodo).toBe(false);

    // 7. Upgrade para PRO Anual
    const resUpgrade = await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_anual' })
      .expect(200);

    expect(resUpgrade.body.assinatura.planoCodigo).toBe('pro_anual');
    expect(resUpgrade.body.assinatura.precoCentavos).toBe(49900);
    expect(resUpgrade.body.assinatura.periodicidade).toBe('ANUAL');
    expect(resUpgrade.body.assinatura.aguardandoPagamento).toBe(true);
    // o pedido mensal não pago foi substituído: só a fatura anual fica em aberto
    expect(
      resUpgrade.body.faturas.filter((f: { status: string }) => f.status === 'PENDENTE'),
    ).toHaveLength(1);
    expect(resUpgrade.body.licenca.plano).toBe('trial');
  });

  it('não assina o gratuito, plano inativo nem código inexistente', async () => {
    const resCad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    const token = resCad.body.acesso;
    await prisma.plano.update({ where: { codigo: 'pro_anual' }, data: { ativo: false } });

    for (const planoCodigo of ['gratuito', 'pro_anual', 'nao_existe']) {
      const res = await api()
        .post('/api/planos/assinar')
        .set('Authorization', `Bearer ${token}`)
        .send({ planoCodigo })
        .expect(404);
      expect(res.body.codigo).toBe('PLANO_NAO_ENCONTRADO');
    }
    await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'PRO MENSAL; drop' })
      .expect(400);
    expect(await prisma.assinatura.count()).toBe(0);
  });

  it('assinatura já paga não troca de plano pelo painel', async () => {
    const resCad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    const token = resCad.body.acesso;
    await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_mensal' })
      .expect(200);
    await prisma.fatura.updateMany({ data: { status: 'PAGA', pagaEm: new Date() } });

    const res = await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_anual' })
      .expect(409);
    expect(res.body.codigo).toBe('TROCA_DE_PLANO_PELO_SUPORTE');
  });
});
