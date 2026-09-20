import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { decifrar } from '../../src/comum/utils/cifra.js';
import type { Env } from '../../src/config/env.js';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Fotógrafo Financeiro',
  email: 'financeiro@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'fotografo-financeiro',
};

describe('financeiro e mercado pago (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let chaveCifra: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp((b) =>
      b.overrideProvider(EmailService).useValue({
        enviar: async () => {},
      }),
    );
    prisma = app.get(PrismaService);
    const config = app.get(ConfigService<Env, true>);
    chaveCifra = config.get('CHAVE_CIFRA_TOKENS') || 'chave-secreta-padrao-dev-fotoraw-2026';
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

  it('fluxo financeiro completo: saldos, configuração de taxas, OAuth MP com token cifrado e desconexão', async () => {
    // 1. Cadastra fotógrafo
    const resCad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    const token = resCad.body.acesso;
    const contaId = resCad.body.conta.id;

    // 2. Consulta saldo inicial
    const resSaldoInicial = await api()
      .get('/api/financeiro/saldo')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resSaldoInicial.body).toMatchObject({
      saldoDisponivelCentavos: 0,
      saldoTotalRepassadoCentavos: 0,
      conexaoMercadoPago: { conectado: false },
      configuracao: { taxasParaCliente: false },
    });

    // 3. Obtém dados para conexão do Mercado Pago
    const resUrlMp = await api()
      .get('/api/financeiro/mercado-pago/conectar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resUrlMp.body.state).toBeDefined();
    const state = resUrlMp.body.state;

    // 4. Executa callback do Mercado Pago (modo simulado)
    const resCallback = await api()
      .post('/api/financeiro/mercado-pago/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'simulado_auth_code_123',
        state,
      })
      .expect(201);

    expect(resCallback.body).toMatchObject({
      conectado: true,
      rotulo: 'vendedor-teste@mercadopago.local',
    });

    // 5. VALIDAÇÃO DE SEGURANÇA: Token no banco DEVE estar cifrado com AES-256-GCM
    const conexaoNoBanco = await prisma.conexaoPagamento.findFirstOrThrow({
      where: { contaId, provedor: 'MERCADOPAGO' },
    });

    expect(conexaoNoBanco.accessTokenCifrado).not.toBe('');
    expect(conexaoNoBanco.accessTokenCifrado).not.toContain('APP_USR_SIMULADO');
    expect(conexaoNoBanco.accessTokenCifrado.split(':')).toHaveLength(3); // formato iv:tag:data

    // Descriptografa com o segredo e valida coincidência
    const tokenDecifrado = decifrar(conexaoNoBanco.accessTokenCifrado, chaveCifra);
    expect(tokenDecifrado).toContain('APP_USR_SIMULADO');

    // 6. Atualiza opções de taxas e Chave Pix
    const resTaxas = await api()
      .patch('/api/financeiro/taxas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        taxasParaCliente: true,
        chavePix: 'financeiro@fotoraw.local',
        cnpjCpf: '12345678901',
      })
      .expect(200);

    expect(resTaxas.body).toMatchObject({
      taxasParaCliente: true,
      chavePix: 'financeiro@fotoraw.local',
      cnpjCpf: '12345678901',
    });

    // 7. Confere que saldo agora reflete MP conectado e taxas ativas
    const resSaldoAposConexao = await api()
      .get('/api/financeiro/saldo')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resSaldoAposConexao.body.conexaoMercadoPago.conectado).toBe(true);
    expect(resSaldoAposConexao.body.configuracao.taxasParaCliente).toBe(true);
    expect(resSaldoAposConexao.body.configuracao.chavePix).toBe('financeiro@fotoraw.local');

    // 8. Desconecta Mercado Pago
    await api()
      .delete('/api/financeiro/mercado-pago')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const resSaldoFinal = await api()
      .get('/api/financeiro/saldo')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resSaldoFinal.body.conexaoMercadoPago.conectado).toBe(false);
  });
});
