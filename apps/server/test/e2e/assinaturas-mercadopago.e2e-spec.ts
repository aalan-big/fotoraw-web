import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import { NotificacoesService } from '../../src/modulos/notificacoes/notificacoes.service.js';
import {
  MercadoPagoCliente,
  MercadoPagoRecusouExcecao,
} from '../../src/modulos/pagamentos/provedores/mercadopago/mercadopago.cliente.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Fotógrafo Cartão E2E',
  email: 'fotografo.cartao@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'fotografo-cartao-e2e',
};

/** O MP de mentira: guarda o que foi pedido e devolve o que o teste mandar. */
const mp = {
  configurado: true,
  criadas: [] as Record<string, unknown>[],
  status: new Map<string, string>(),
  preapprovals: new Map<string, { id: string; status: string; external_reference: string }>(),
  cobrancas: new Map<string, Record<string, unknown>>(),
  async criarAssinatura(corpo: Record<string, unknown>) {
    if (corpo.card_token_id === 'tok-recusado') throw new MercadoPagoRecusouExcecao('Invalid card');
    const id = `pre-${mp.criadas.length + 1}`;
    mp.criadas.push(corpo);
    mp.preapprovals.set(id, {
      id,
      status: 'authorized',
      external_reference: String(corpo.external_reference),
    });
    return { id, status: 'authorized' };
  },
  async obterAssinatura(id: string) {
    return mp.preapprovals.get(id)!;
  },
  async alterarStatusAssinatura(id: string, status: string) {
    mp.status.set(id, status);
    const pre = mp.preapprovals.get(id);
    if (pre) pre.status = status;
    return pre;
  },
  async resumoDoToken() {
    return { live_mode: true };
  },
  async obterCobranca(id: string) {
    const c = mp.cobrancas.get(id);
    if (!c) throw new MercadoPagoRecusouExcecao(`The Authorized Payment with id ${id} does not exist`, 404);
    return c;
  },
};

/** Celular do admin de mentira: guarda os avisos. */
const avisos: { titulo: string; corpo: string }[] = [];
const notificacoes = {
  ativo: true,
  chavePublica: 'x',
  async avisarAdmins(aviso: { titulo: string; corpo: string }) {
    avisos.push(aviso);
    return 1;
  },
};

describe('assinatura de plano no cartão pelo Mercado Pago (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  const webhook = (tipo: string, dataId: string, notificacao: string) =>
    api()
      .post(`/api/pagamentos/webhooks/mercadopago?data.id=${dataId}&type=${tipo}`)
      .send({ id: notificacao, type: tipo, action: 'updated', data: { id: dataId } });

  beforeAll(async () => {
    app = await criarApp((b) =>
      b
        .overrideProvider(EmailService)
        .useValue({ enviar: async () => {} })
        .overrideProvider(MercadoPagoCliente)
        .useValue(mp)
        .overrideProvider(NotificacoesService)
        .useValue(notificacoes),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    mp.criadas.length = 0;
    mp.status.clear();
    mp.preapprovals.clear();
    mp.cobrancas.clear();
    avisos.length = 0;
    await prisma.plano.createMany({
      data: [
        {
          codigo: 'gratuito',
          nome: 'Gratuito',
          precoCentavos: 0,
          periodicidade: 'NENHUMA',
          comissaoEventoPct: 10,
          limiteArmazenamentoMb: 5120,
          ordem: 1,
        },
        {
          codigo: 'pro_mensal',
          nome: 'PRO',
          precoCentavos: 5990,
          periodicidade: 'MENSAL',
          comissaoEventoPct: 0,
          limiteArmazenamentoMb: 15360,
          limiteDispositivos: 3,
          permiteEnsaio: true,
          permiteGaleriaPrivada: true,
          permiteGestaoEstudio: true,
          ordem: 3,
        },
        {
          codigo: 'business_mensal',
          nome: 'Business',
          precoCentavos: 12000,
          periodicidade: 'MENSAL',
          comissaoEventoPct: 0,
          limiteArmazenamentoMb: 204800,
          limiteDispositivos: 3,
          permiteEnsaio: true,
          permiteGaleriaPrivada: true,
          permiteGestaoEstudio: true,
          ordem: 4,
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function cadastrar() {
    const res = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    return res.body.acesso as string;
  }

  it('assinar com o cartão do Brick → cobrança aprovada no webhook libera o plano; aviso repetido não paga 2×', async () => {
    const token = await cadastrar();

    const pedido = await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-cartao-1', email: 'pagador@cartao.local' } })
      .expect(200);
    expect(pedido.body.assinatura).toMatchObject({
      aguardandoPagamento: true,
      cobrancaAutomatica: true,
      cartaoEmAnalise: true,
    });
    // o que foi pedido ao MP: R$ 59,90 por mês, ligado à nossa assinatura
    expect(mp.criadas[0]).toMatchObject({
      reason: 'FotoRAW PRO',
      external_reference: pedido.body.assinatura.id,
      // o e-mail é o que o fotógrafo pôs no formulário do cartão, não o da conta
      payer_email: 'pagador@cartao.local',
      card_token_id: 'tok-cartao-1',
      status: 'authorized',
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 59.9, currency_id: 'BRL' },
    });
    expect(String(mp.criadas[0]!.back_url)).toMatch(/\/plano$/);
    expect(pedido.body.licenca.plano).toBe('trial');

    // cartão cadastrado: o MP avisa a assinatura (nada a fazer além de registrar)
    mp.preapprovals.get('pre-1')!.status = 'authorized';
    await webhook('subscription_preapproval', 'pre-1', 'n-1').expect(200);

    // cobrança recusada: não libera nada
    mp.cobrancas.set('900', { id: 900, preapproval_id: 'pre-1', status: 'recycling', payment: { status: 'rejected' } });
    await webhook('subscription_authorized_payment', '900', 'n-2').expect(200);
    let status = await api().get('/api/planos/meu-status').set('Authorization', `Bearer ${token}`).expect(200);
    expect(status.body.assinatura.aguardandoPagamento).toBe(true);

    // cobrança aprovada: fatura paga, licença do plano, próxima fatura pendente
    mp.cobrancas.set('901', {
      id: 901,
      preapproval_id: 'pre-1',
      status: 'processed',
      transaction_amount: 59.9,
      debit_date: new Date().toISOString(),
      payment: { id: 5551, status: 'approved' },
    });
    const aviso = await webhook('subscription_authorized_payment', '901', 'n-3').expect(200);
    expect(aviso.body.resultado).toMatch(/paga/);

    status = await api().get('/api/planos/meu-status').set('Authorization', `Bearer ${token}`).expect(200);
    expect(status.body.assinatura).toMatchObject({ aguardandoPagamento: false, cartaoEmAnalise: false });
    expect(status.body.licenca).toMatchObject({ plano: 'pro', tipo: 'ASSINATURA', planoCodigo: 'pro_mensal' });
    expect(status.body.licenca.recursos.limite_armazenamento_mb).toBe(15360);
    expect(status.body.faturas.map((f: { status: string }) => f.status).sort()).toEqual(['PAGA', 'PENDENTE']);

    // o MP reenvia o mesmo aviso, e manda outro aviso da mesma cobrança: nada muda
    await webhook('subscription_authorized_payment', '901', 'n-3').expect(200);
    await webhook('subscription_authorized_payment', '901', 'n-4').expect(200);
    expect(await prisma.fatura.count({ where: { status: 'PAGA' } })).toBe(1);
    expect(await prisma.licenca.count({ where: { status: 'ATIVA', tipo: 'ASSINATURA' } })).toBe(1);
    expect(await prisma.webhookRecebido.count()).toBe(4);

    // celular do admin: 1 aviso de recusa e 1 de pagamento (o reenvio não repete)
    expect(avisos.map((a) => a.titulo)).toEqual(['Cobrança recusada', 'Pagamento recebido 💰']);
    expect(avisos[1]!.corpo).toBe(`${FOTOGRAFO.nome} · PRO · R$ 59,90`);
  });

  it('cancelar com plano pago pausa no MP (vale até o fim); reativar retoma', async () => {
    const token = await cadastrar();
    await api().post('/api/planos/assinar').set('Authorization', `Bearer ${token}`).send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-cartao-1', email: 'pagador@cartao.local' } }).expect(200);
    mp.cobrancas.set('1', { id: 1, preapproval_id: 'pre-1', status: 'processed', payment: { status: 'approved' } });
    await webhook('subscription_authorized_payment', '1', 'n-1').expect(200);

    const cancelada = await api().post('/api/planos/cancelar').set('Authorization', `Bearer ${token}`).send({}).expect(200);
    expect(mp.status.get('pre-1')).toBe('paused');
    expect(cancelada.body.assinatura).toMatchObject({ status: 'ATIVA', cancelaNoFimDoPeriodo: true });
    expect(cancelada.body.licenca.plano).toBe('pro');

    // o aviso "paused" que o MP manda depois não muda nada
    await webhook('subscription_preapproval', 'pre-1', 'n-2').expect(200);

    const reativada = await api().post('/api/planos/reativar').set('Authorization', `Bearer ${token}`).expect(200);
    expect(mp.status.get('pre-1')).toBe('authorized');
    expect(reativada.body.assinatura.cancelaNoFimDoPeriodo).toBe(false);
    expect(reativada.body.faturas.filter((f: { status: string }) => f.status === 'PENDENTE')).toHaveLength(1);
  });

  it('desistir antes de pagar cancela o pedido no MP; trocar de plano cancela o pedido anterior', async () => {
    const token = await cadastrar();
    await api().post('/api/planos/assinar').set('Authorization', `Bearer ${token}`).send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-cartao-1', email: 'pagador@cartao.local' } }).expect(200);

    const troca = await api().post('/api/planos/assinar').set('Authorization', `Bearer ${token}`).send({ planoCodigo: 'business_mensal', cartao: { token: 'tok-cartao-1', email: 'pagador@cartao.local' } }).expect(200);
    expect(mp.status.get('pre-1')).toBe('cancelled');
    expect(troca.body.assinatura).toMatchObject({ planoCodigo: 'business_mensal', cartaoEmAnalise: true });
    expect(mp.criadas[1]).toMatchObject({ auto_recurring: { transaction_amount: 120 } });

    const desistiu = await api().post('/api/planos/cancelar').set('Authorization', `Bearer ${token}`).send({}).expect(200);
    expect(mp.status.get('pre-2')).toBe('cancelled');
    expect(desistiu.body.assinatura).toBeNull();
    expect(await prisma.assinatura.count({ where: { status: 'CANCELADA' } })).toBe(2);
  });

  it('sem cartão não assina; cartão recusado no cadastro não deixa pedido pendurado', async () => {
    const token = await cadastrar();
    const sem = await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_mensal' })
      .expect(422);
    expect(sem.body.codigo).toBe('CARTAO_OBRIGATORIO');

    const recusado = await api()
      .post('/api/planos/assinar')
      .set('Authorization', `Bearer ${token}`)
      .send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-recusado', email: 'x@y.local' } })
      .expect(422);
    expect(recusado.body).toMatchObject({ codigo: 'MERCADOPAGO_RECUSOU' });
    expect(recusado.body.mensagem).toMatch(/Invalid card/);
    const status = await api().get('/api/planos/meu-status').set('Authorization', `Bearer ${token}`).expect(200);
    expect(status.body.assinatura).toBeNull();
    expect(status.body.chaveMercadoPago).toBeNull(); // sem MERCADOPAGO_PUBLIC_KEY no .env.test
  });

  it('mesmo plano de novo troca o cartão: cancela a assinatura anterior no MP', async () => {
    const token = await cadastrar();
    const r1 = await api().post('/api/planos/assinar').set('Authorization', `Bearer ${token}`).send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-cartao-1', email: 'a@b.local' } }).expect(200);
    const r2 = await api().post('/api/planos/assinar').set('Authorization', `Bearer ${token}`).send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-cartao-2', email: 'a@b.local' } }).expect(200);
    expect(r2.body.assinatura.id).toBe(r1.body.assinatura.id);
    expect(mp.status.get('pre-1')).toBe('cancelled');
    expect(mp.criadas[1]).toMatchObject({ card_token_id: 'tok-cartao-2', external_reference: r1.body.assinatura.id });
    expect(await prisma.assinatura.findUnique({ where: { id: r1.body.assinatura.id } })).toMatchObject({
      provedorAssinaturaId: 'pre-2',
    });
  });

  it('assinatura cancelada pelo app do MP antes de pagar morre aqui também', async () => {
    const token = await cadastrar();
    await api().post('/api/planos/assinar').set('Authorization', `Bearer ${token}`).send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-cartao-1', email: 'pagador@cartao.local' } }).expect(200);
    mp.preapprovals.get('pre-1')!.status = 'cancelled';
    await webhook('subscription_preapproval', 'pre-1', 'n-1').expect(200);
    const status = await api().get('/api/planos/meu-status').set('Authorization', `Bearer ${token}`).expect(200);
    expect(status.body.assinatura).toBeNull();
  });

  it('cobrança que chega depois do pedido cancelado não reabre o plano e avisa o admin', async () => {
    const token = await cadastrar();
    await api().post('/api/planos/assinar').set('Authorization', `Bearer ${token}`).send({ planoCodigo: 'pro_mensal', cartao: { token: 'tok-cartao-1', email: 'a@b.local' } }).expect(200);
    await api().post('/api/planos/cancelar').set('Authorization', `Bearer ${token}`).send({}).expect(200);
    mp.cobrancas.set('55', { id: 55, preapproval_id: 'pre-1', status: 'processed', transaction_amount: 59.9, payment: { status: 'approved' } });
    const res = await webhook('subscription_authorized_payment', '55', 'n-1').expect(200);
    expect(res.body.resultado).toMatch(/já encerrada/);
    expect(await prisma.fatura.count({ where: { status: 'PAGA' } })).toBe(0);
    expect(avisos.map((a) => a.titulo)).toEqual(['Cobrança em assinatura cancelada']);
    const status = await api().get('/api/planos/meu-status').set('Authorization', `Bearer ${token}`).expect(200);
    expect(status.body.licenca.plano).toBe('trial');
  });

  it('cobrança que o MP diz não existir: tenta de novo, e depois de 2 h desiste', async () => {
    // qualquer resposta que não seja 2xx faz o MP reenviar
    await webhook('subscription_authorized_payment', '404404', 'n-1').expect(422);
    let w = await prisma.webhookRecebido.findFirstOrThrow();
    expect(w.processadoEm).toBeNull();
    expect(w.erro).toMatch(/does not exist/);
    // o MP reenviou 3 h depois
    await prisma.webhookRecebido.update({
      where: { id: w.id },
      data: { criadoEm: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    });
    const res = await webhook('subscription_authorized_payment', '404404', 'n-1').expect(200);
    expect(res.body.resultado).toMatch(/ignorado/);
    w = await prisma.webhookRecebido.findFirstOrThrow();
    expect(w.processadoEm).not.toBeNull();
  });

  it('aviso de cobrança de assinatura que não é nossa só é registrado', async () => {
    mp.cobrancas.set('77', { id: 77, preapproval_id: 'de-outro-sistema', status: 'processed', payment: { status: 'approved' } });
    const res = await webhook('subscription_authorized_payment', '77', 'n-1').expect(200);
    expect(res.body.resultado).toMatch(/não é nosso/);
    expect(await prisma.fatura.count()).toBe(0);
  });
});
