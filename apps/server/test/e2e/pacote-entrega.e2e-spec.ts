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
import { PublicoService } from '../../src/modulos/publico/publico.service.js';
import { limparBanco } from '../utils/banco.js';
import { criarApp } from '../utils/criar-app.js';

const FOTOGRAFO = {
  nome: 'Estúdio Luz',
  email: 'luz-pacote@fotoraw.local',
  senha: 'senha-segura-e2e-2026',
  slug: 'estudio-luz',
};
const COMPRADOR = { nome: 'Ana Souza', email: 'ana@exemplo.com', cpf: '529.982.247-25' };

describe('pacote (escolha + extras) e entrega (download direto) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: Email[] = [];
  const criados: Record<string, unknown>[] = [];
  const api = () => request(app.getHttpServer());
  let contaId: string;

  beforeAll(async () => {
    const mp = {
      async criarPagamento(_t: string, corpo: Record<string, unknown>) {
        criados.push(corpo);
        return {
          id: 5000 + criados.length,
          status: 'approved',
          external_reference: corpo.external_reference,
          transaction_amount: corpo.transaction_amount,
          date_approved: new Date().toISOString(),
          fee_details: [],
        } as PagamentoMp;
      },
    };
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
    app.get(PublicoService).tentativasCodigo.reiniciar();
    emails.length = 0;
    criados.length = 0;
    await prisma.plano.create({
      data: { codigo: 'gratuito', nome: 'Gratuito', precoCentavos: 0, periodicidade: 'NENHUMA', comissaoEventoPct: 10, limiteDispositivos: 1, permiteEvento: true, ordem: 1 },
    });
    const cad = await api().post('/api/auth/cadastro').send(FOTOGRAFO).expect(201);
    contaId = cad.body.conta.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function galeria(dados: Record<string, unknown>, fotos = 4) {
    const g = await prisma.galeria.create({
      data: {
        contaId,
        ensaioIdDesktop: `e-${dados.slug}`,
        titulo: 'Ensaio',
        modalidade: 'ENSAIO_INTERNO',
        visibilidade: 'PRIVADA',
        status: 'PUBLICADA',
        modoVenda: 'PACOTE',
        slug: 'x',
        ...dados,
      } as never,
    });
    const ids: string[] = [];
    for (let i = 0; i < fotos; i++) {
      const f = await prisma.foto.create({
        data: { galeriaId: g.id, fotoIdDesktop: `f${i}`, previewKey: `p/${i}.webp`, altaKey: `originais/${g.id}/f${i}.jpg`, ordem: i },
      });
      ids.push(f.id);
    }
    return { g, ids };
  }

  async function conectarMp() {
    const chave = app.get(ConfigService).get('CHAVE_CIFRA_TOKENS') || 'chave-secreta-padrao-dev-fotoraw-2026';
    await prisma.conexaoPagamento.create({
      data: { contaId, provedor: 'MERCADOPAGO', provedorUsuarioId: '1', accessTokenCifrado: cifrar('APP_USR-x', chave), publicKey: 'APP_USR-pk', tokenExpiraEm: new Date(Date.now() + 9e9) },
    });
  }

  const pedir = (galeriaId: string, fotoIds: string[], codigo = 'LUZ-1000') =>
    api().post('/api/publico/pedidos').send({ galeriaId, fotoIds, codigo, comprador: COMPRADOR, aceitouTermos: true });

  it('pacote: as incluídas saem sem pagar (seleção vale na hora), o que passar é extra pago, sem comissão', async () => {
    const { g, ids } = await galeria({ slug: 'gestante', codigoAcesso: 'LUZ-1000', fotosIncluidas: 2, precoPacoteCentavos: 80000, precoFotoCentavos: 2500 });

    const aberta = await api().get('/api/publico/galerias/estudio-luz/gestante').query({ codigo: 'LUZ-1000' }).expect(200);
    // sem MP: escolhe as incluídas, mas extras não
    expect(aberta.body).toMatchObject({ podeComprar: true, pacote: { incluidas: 2, restantes: 2, extrasDisponiveis: false, jaEscolhidas: [] } });

    // 2 incluídas: R$ 0, liberadas na hora (sem Mercado Pago)
    const sel = await pedir(g.id, [ids[0]!, ids[1]!]).expect(201);
    expect(sel.body.pago).toBe(true);
    const p1 = await prisma.pedido.findUniqueOrThrow({ where: { id: sel.body.id }, include: { itens: true, downloads: true } });
    expect(p1).toMatchObject({ status: 'PAGO', subtotalCentavos: 0, comissaoCentavos: 0 });
    expect(p1.itens.every((i) => i.incluida && i.precoCentavos === 0)).toBe(true);
    expect(p1.downloads).toHaveLength(2);
    expect(criados).toHaveLength(0);
    expect(emails.some((e) => /Seleção #/.test(e.assunto))).toBe(true);

    const depois = await api().get('/api/publico/galerias/estudio-luz/gestante').query({ codigo: 'LUZ-1000' }).expect(200);
    expect(depois.body.pacote).toMatchObject({ restantes: 0 });
    expect(depois.body.pacote.jaEscolhidas.sort()).toEqual([ids[0], ids[1]].sort());

    // repetir foto já escolhida: recusa; extra sem MP conectado: recusa
    await pedir(g.id, [ids[0]!]).expect(409);
    const semMp = await pedir(g.id, [ids[2]!]).expect(409);
    expect(semMp.body.codigo).toBe('VENDAS_INDISPONIVEIS');

    // com MP: extras pelo preço da foto extra, ensaio = 0% de comissão
    await conectarMp();
    const extra = await pedir(g.id, [ids[2]!, ids[3]!]).expect(201);
    expect(extra.body.pago).toBe(false);
    const p2 = await prisma.pedido.findUniqueOrThrow({ where: { id: extra.body.id } });
    expect(p2).toMatchObject({ subtotalCentavos: 5000, comissaoCentavos: 0 });
    const cartao = { token: 'tok_cartao_teste_123456789', paymentMethodId: 'visa', parcelas: 1, email: 'ana@exemplo.com', cpf: COMPRADOR.cpf };
    const pago = await api().post(`/api/publico/pedidos/${extra.body.id}/cartao`).send(cartao).expect(200);
    expect(pago.body.status).toBe('PAGO');
    expect(criados[0]).not.toHaveProperty('application_fee'); // ensaio: sem comissão do FotoRAW
  });

  it('pacote sem foto extra: passar do incluído é recusado', async () => {
    const { g, ids } = await galeria({ slug: 'newborn', codigoAcesso: 'LUZ-1000', fotosIncluidas: 1, precoFotoCentavos: null });
    const r = await pedir(g.id, [ids[0]!, ids[1]!]).expect(409);
    expect(r.body.mensagem).toMatch(/não tem fotos extras/);
  });

  it('entrega: baixa direto com o código, sem carrinho', async () => {
    const { ids } = await galeria({ slug: 'entrega', codigoAcesso: 'LUZ-2000', modoVenda: 'ENTREGA' }, 2);
    const g = await api().get('/api/publico/galerias/estudio-luz/entrega').query({ codigo: 'LUZ-2000' }).expect(200);
    expect(g.body).toMatchObject({ podeBaixar: true, podeComprar: false, pacote: null });

    const url = `/api/publico/galerias/estudio-luz/entrega/fotos/${ids[0]}/arquivo`;
    await api().get(url).expect(403); // sem código
    await api().get(url).query({ codigo: 'LUZ-9999' }).expect(403);
    const ok = await api().get(url).query({ codigo: 'luz-2000', modo: 'ver' }).expect(302);
    expect(ok.headers.location).toContain('X-Amz-Signature');
    expect(decodeURIComponent(ok.headers.location)).toContain('inline;');

    // entrega não vende; foto de outra galeria não baixa
    const { g: outra } = await galeria({ slug: 'outra', codigoAcesso: 'LUZ-3000' }, 1);
    await pedir((await prisma.galeria.findFirstOrThrow({ where: { slug: 'entrega' } })).id, [ids[0]!], 'LUZ-2000').expect(409);
    const fotoOutra = await prisma.foto.findFirstOrThrow({ where: { galeriaId: outra.id } });
    await api().get(`/api/publico/galerias/estudio-luz/entrega/fotos/${fotoOutra.id}/arquivo`).query({ codigo: 'LUZ-2000' }).expect(404);

    // galeria vendida (pacote/avulso) não libera pelo link da entrega
    await api().get(`/api/publico/galerias/estudio-luz/outra/fotos/${fotoOutra.id}/arquivo`).query({ codigo: 'LUZ-3000' }).expect(403);
  });
});
