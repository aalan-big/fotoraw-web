import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { cifrar } from '../../src/comum/utils/cifra.js';
import { type Email, EmailService } from '../../src/infra/email/email.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { LimitadorTentativas } from '../../src/modulos/auth/senha/limitador-tentativas.js';
import {
  MercadoPagoCliente,
  type PagamentoMp,
} from '../../src/modulos/pagamentos/provedores/mercadopago/mercadopago.cliente.js';
import { MercadoPagoWebhookService } from '../../src/modulos/pagamentos/webhooks/mercadopago-webhook.service.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Estúdio Luz',
  email: 'luz-vendas@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'estudio-luz',
};
const COMPRADOR = {
  nome: 'Maria da Silva',
  email: 'Maria@Exemplo.com',
  whatsapp: '(41) 99999-0000',
  cpf: '529.982.247-25',
};
const TOKEN_VENDEDOR = 'APP_USR-token-do-fotografo';

/** O Mercado Pago simulado: guarda as chamadas e devolve o que o teste mandar. */
class MpFalso {
  criados: { token: string; corpo: Record<string, unknown>; idempotencia: string }[] = [];
  pagamentos = new Map<string, PagamentoMp>();
  private proximoId = 1000;
  /** status que o próximo pagamento de cartão nasce */
  statusCartao: PagamentoMp['status'] = 'approved';

  async criarPagamento(token: string, corpo: Record<string, unknown>, idempotencia: string) {
    this.criados.push({ token, corpo, idempotencia });
    const id = this.proximoId++;
    const pix = corpo.payment_method_id === 'pix';
    const pag: PagamentoMp = {
      id,
      status: pix ? 'pending' : this.statusCartao,
      external_reference: corpo.external_reference as string,
      transaction_amount: corpo.transaction_amount as number,
      date_approved: pix || this.statusCartao !== 'approved' ? null : new Date().toISOString(),
      fee_details: [{ type: 'mercadopago_fee', amount: 0.3 }],
      point_of_interaction: pix
        ? { transaction_data: { qr_code: `00020126PIX${id}`, qr_code_base64: 'iVBORw0KGgo=' } }
        : undefined,
    };
    this.pagamentos.set(String(id), pag);
    return pag;
  }

  async obterPagamento(_token: string, id: string) {
    const p = this.pagamentos.get(id);
    if (!p) throw new Error(`pagamento ${id} não existe`);
    return p;
  }

  aprovar(id: string, mudar: Partial<PagamentoMp> = {}) {
    const p = this.pagamentos.get(id)!;
    Object.assign(p, { status: 'approved', date_approved: new Date().toISOString(), ...mudar });
  }
}

describe('vendas: carrinho → pedido → Pix/cartão → download (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mp: MpFalso;
  const emails: Email[] = [];
  const api = () => request(app.getHttpServer());
  let contaId: string;
  let galeriaId: string;
  let fotoIds: string[];

  beforeAll(async () => {
    mp = new MpFalso();
    app = await criarApp((b) =>
      b
        .overrideProvider(EmailService)
        .useValue({ enviar: async (e: Email) => void emails.push(e) })
        .overrideProvider(MercadoPagoCliente)
        .useValue(mp),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBanco(app);
    app.get(LimitadorTentativas).reiniciar();
    emails.length = 0;
    mp.criados.length = 0;
    mp.pagamentos.clear();
    mp.statusCartao = 'approved';

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
    const galeria = await prisma.galeria.create({
      data: {
        contaId,
        ensaioIdDesktop: 'ensaio-1',
        titulo: 'Corrida 10k',
        slug: 'corrida-10k',
        modalidade: 'EVENTO',
        visibilidade: 'PUBLICA',
        modoVenda: 'AVULSO',
        precoFotoCentavos: 1500,
        status: 'PUBLICADA',
        publicadaEm: new Date(),
        totalFotos: 3,
      },
    });
    galeriaId = galeria.id;
    fotoIds = [];
    for (let i = 0; i < 3; i++) {
      const f = await prisma.foto.create({
        data: {
          galeriaId,
          fotoIdDesktop: `f${i}`,
          previewKey: `previews/${contaId}/${galeriaId}/f${i}.v1.webp`,
          altaKey: `originais/${contaId}/${galeriaId}/f${i}.jpg`,
          precoCentavos: i === 2 ? 2500 : null,
          ordem: i,
        },
      });
      fotoIds.push(f.id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function conectarMp() {
    const chave = app.get(ConfigService).get('CHAVE_CIFRA_TOKENS') || 'chave-secreta-padrao-dev-fotoraw-2026';
    await prisma.conexaoPagamento.create({
      data: {
        contaId,
        provedor: 'MERCADOPAGO',
        provedorUsuarioId: '123456',
        accessTokenCifrado: cifrar(TOKEN_VENDEDOR, chave),
        tokenExpiraEm: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
        publicKey: 'APP_USR-public-key-do-fotografo',
      },
    });
  }

  const novoPedido = (fotos = fotoIds.slice(0, 2), extra: Record<string, unknown> = {}) =>
    api()
      .post('/api/publico/pedidos')
      .send({ galeriaId, fotoIds: fotos, comprador: COMPRADOR, aceitouTermos: true, ...extra });

  it('sem Mercado Pago conectado a galeria não vende', async () => {
    const g = await api().get('/api/publico/galerias/estudio-luz/corrida-10k').expect(200);
    expect(g.body).toMatchObject({ podeComprar: false, vendasEmBreve: true });
    const r = await novoPedido().expect(409);
    expect(r.body.codigo).toBe('VENDAS_INDISPONIVEIS');
  });

  it('Pix: preço e comissão calculados no server, split pro FotoRAW, webhook libera os downloads', async () => {
    await conectarMp();
    const g = await api().get('/api/publico/galerias/estudio-luz/corrida-10k').expect(200);
    expect(g.body).toMatchObject({ podeComprar: true, vendasEmBreve: false });

    // validações de entrada
    await novoPedido(fotoIds.slice(0, 2), { comprador: { ...COMPRADOR, cpf: '111.111.111-11' } }).expect(400);
    await novoPedido(fotoIds.slice(0, 2), { aceitouTermos: false }).expect(400);
    await novoPedido([fotoIds[0]!, '01a13fa3-7a33-70ad-a7b0-f04a3acc72c4']).expect(409);

    // 1 foto de R$15 (preço da galeria) + 1 de R$25 (preço próprio)
    const criado = await novoPedido([fotoIds[0]!, fotoIds[2]!]).expect(201);
    const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: criado.body.id } });
    expect(pedido).toMatchObject({ subtotalCentavos: 4000, totalCentavos: 4000, comissaoCentavos: 400 });
    expect(Number(pedido.comissaoPct)).toBe(10);
    const comprador = await prisma.comprador.findUniqueOrThrow({ where: { email: 'maria@exemplo.com' } });
    expect(comprador).toMatchObject({ cpf: '52998224725', whatsapp: '41999990000' });

    const pix = await api().post(`/api/publico/pedidos/${pedido.id}/pix`).expect(200);
    expect(pix.body.status).toBe('AGUARDANDO_PAGAMENTO');
    expect(pix.body.pix.copiaCola).toMatch(/^00020126PIX/);
    expect(pix.body.publicKey).toBe('APP_USR-public-key-do-fotografo');
    expect(mp.criados).toHaveLength(1);
    expect(mp.criados[0]).toMatchObject({
      token: TOKEN_VENDEDOR, // na conta do fotógrafo
      corpo: {
        transaction_amount: 40,
        application_fee: 4, // comissão do FotoRAW, limpa
        payment_method_id: 'pix',
        external_reference: pedido.id,
        payer: { email: 'maria@exemplo.com', identification: { type: 'CPF', number: '52998224725' } },
      },
    });

    // pedir Pix de novo devolve o mesmo (sem cobrança duplicada)
    await api().post(`/api/publico/pedidos/${pedido.id}/pix`).expect(200);
    expect(mp.criados).toHaveLength(1);

    // antes de pagar: nada de download
    const antes = await api().get(`/api/publico/pedidos/${pedido.id}`).expect(200);
    expect(antes.body.itens.every((i: { download: unknown }) => i.download === null)).toBe(true);

    // MP aprova e avisa pelo webhook (duas vezes: idempotente)
    const idMp = String(mp.criados.length && [...mp.pagamentos.keys()][0]);
    mp.aprovar(idMp);
    const webhooks = app.get(MercadoPagoWebhookService);
    const aviso = { tipo: 'payment', dataId: idMp, payload: {} };
    expect((await webhooks.receber({ ...aviso, eventoRef: 'ev-1' })).resultado).toMatch(/pago/);
    await webhooks.receber({ ...aviso, eventoRef: 'ev-2' });

    const pago = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    // taxa do MP (R$0,30) sai do fotógrafo: 4000 − 400 − 30
    expect(pago).toMatchObject({ status: 'PAGO', taxaProvedorCentavos: 30, repasseCentavos: 3570 });
    expect(await prisma.download.count({ where: { pedidoId: pedido.id } })).toBe(2);
    const galeria = await prisma.galeria.findUniqueOrThrow({ where: { id: galeriaId } });
    expect(galeria.totalVendasCentavos).toBe(4000);

    // um e-mail pro comprador (link do pedido) e um pro fotógrafo
    const daVenda = emails.filter((e) => /liberadas|Venda #/.test(e.assunto));
    expect(daVenda.map((e) => e.para).sort()).toEqual([FOTOGRAFO.email, 'maria@exemplo.com'].sort());
    expect(emails.find((e) => e.para === 'maria@exemplo.com')!.html).toContain(`/pedido/${pedido.id}`);

    // download: link assinado do original, no máximo 5 vezes
    const tela = await api().get(`/api/publico/pedidos/${pedido.id}`).expect(200);
    expect(tela.body.status).toBe('PAGO');
    expect(tela.body.pix).toBeNull();
    const token = tela.body.itens[0].download.token as string;
    for (let i = 1; i <= 5; i++) {
      const d = await api().get(`/api/publico/downloads/${token}`).expect(200);
      expect(d.body.url).toContain('X-Amz-Signature');
      expect(d.body.url).toContain('originais');
      expect(d.body.baixadas).toBe(i);
    }
    const limite = await api().get(`/api/publico/downloads/${token}`).expect(410);
    expect(limite.body.codigo).toBe('LIMITE_DOWNLOADS');
    await api().get('/api/publico/downloads/token-que-nao-existe').expect(404);
  });

  it('a tela do pedido confirma sozinha se o webhook não chegar', async () => {
    await conectarMp();
    const criado = await novoPedido().expect(201);
    await api().post(`/api/publico/pedidos/${criado.body.id}/pix`).expect(200);
    const idMp = [...mp.pagamentos.keys()][0]!;
    mp.aprovar(idMp);
    // a reconsulta respeita um intervalo: simula que já passou
    await prisma.pagamento.updateMany({ data: { atualizadoEm: new Date(Date.now() - 60_000) } });
    const tela = await api().get(`/api/publico/pedidos/${criado.body.id}`).expect(200);
    expect(tela.body.status).toBe('PAGO');
  });

  it('cartão aprovado na hora já libera; recusado deixa tentar de novo', async () => {
    await conectarMp();
    const cartao = { token: 'tok_cartao_teste_1234567890', paymentMethodId: 'visa', parcelas: 1, email: 'maria@exemplo.com', cpf: COMPRADOR.cpf };

    const p1 = await novoPedido().expect(201);
    mp.statusCartao = 'rejected';
    const recusado = await api().post(`/api/publico/pedidos/${p1.body.id}/cartao`).send(cartao).expect(200);
    expect(recusado.body).toMatchObject({ status: 'AGUARDANDO_PAGAMENTO', ultimaRecusa: true, cartao: { status: 'rejected' } });

    mp.statusCartao = 'approved';
    const aprovado = await api()
      .post(`/api/publico/pedidos/${p1.body.id}/cartao`)
      .send({ ...cartao, token: 'tok_cartao_teste_outro_000001' })
      .expect(200);
    expect(aprovado.body.status).toBe('PAGO');
    expect(aprovado.body.itens[0].download.token).toBeTruthy();
    expect(mp.criados.at(-1)!.corpo).toMatchObject({ token: 'tok_cartao_teste_outro_000001', application_fee: 3, transaction_amount: 30 });

    // pedido pago não cobra de novo
    await api().post(`/api/publico/pedidos/${p1.body.id}/pix`).expect(409);
  });

  it('pagamento com valor ou referência diferente não libera nada', async () => {
    await conectarMp();
    const criado = await novoPedido().expect(201);
    await api().post(`/api/publico/pedidos/${criado.body.id}/pix`).expect(200);
    const idMp = [...mp.pagamentos.keys()][0]!;
    mp.aprovar(idMp, { transaction_amount: 0.01 });
    const r = await app.get(MercadoPagoWebhookService).receber({ tipo: 'payment', dataId: idMp, eventoRef: 'ev-x', payload: {} });
    expect(r.resultado).toMatch(/não confere/);
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: criado.body.id } })).status).toBe('AGUARDANDO_PAGAMENTO');
    expect(await prisma.download.count()).toBe(0);
  });

  it('aviso de payment que não é venda (ex.: mensalidade) só é registrado', async () => {
    const r = await app
      .get(MercadoPagoWebhookService)
      .receber({ tipo: 'payment', dataId: '999999', eventoRef: 'ev-mensalidade', payload: {} });
    expect(r.resultado).toMatch(/só registrado/);
  });
});
