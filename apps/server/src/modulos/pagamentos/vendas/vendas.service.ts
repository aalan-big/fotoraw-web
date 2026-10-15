import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DominioExcecao, NaoEncontradoExcecao } from '../../../comum/excecoes/dominio.excecao.js';
import type { Env } from '../../../config/env.js';
import { EmailService } from '../../../infra/email/email.service.js';
import { Prisma, type StatusPagamento } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { StorageService } from '../../../infra/storage/storage.service.js';
import { LicencasService } from '../../licencas/licencas.service.js';
import { MercadoPagoCliente, type PagamentoMp } from '../provedores/mercadopago/mercadopago.cliente.js';
import { CredenciaisVendedorService } from './credenciais-vendedor.service.js';
import type { CriarPedidoDto, PagarCartaoDto } from './dto/vendas.dto.js';
import { emailFotosLiberadas, emailVendaRealizada } from './emails-venda.js';

/** comissão de evento quando não dá pra saber o plano (não deveria acontecer) */
const COMISSAO_PADRAO_PCT = 10;
/** o pedido segura as fotos/preço por esse tempo antes de escolher Pix/cartão */
const PEDIDO_VALIDO_MS = 2 * 60 * 60 * 1000;
const PIX_VALIDO_MS = 30 * 60 * 1000;
const DOWNLOAD_VALIDO_DIAS = 30;
const DOWNLOAD_LIMITE = 5;
/** a tela do pedido consulta a cada poucos segundos; o MP só é perguntado nesse intervalo */
const RECONSULTAR_MP_MS = 10_000;

const STATUS_DO_MP: Record<PagamentoMp['status'], StatusPagamento> = {
  pending: 'PENDENTE',
  in_process: 'PENDENTE',
  in_mediation: 'PENDENTE',
  authorized: 'PENDENTE',
  approved: 'APROVADO',
  rejected: 'RECUSADO',
  cancelled: 'EXPIRADO',
  refunded: 'ESTORNADO',
  charged_back: 'ESTORNADO',
};

const reais = (centavos: number) => Math.round(centavos) / 100;

class PedidoIndisponivelExcecao extends DominioExcecao {
  constructor(mensagem: string) {
    super('PEDIDO_INDISPONIVEL', mensagem, HttpStatus.CONFLICT);
  }
}

/**
 * Venda avulsa de fotos com split no Mercado Pago:
 * - o pagamento é criado com o token OAuth do fotógrafo → o dinheiro cai na conta dele;
 * - `application_fee` = comissão do FotoRAW, retida pelo MP na conta do FotoRAW;
 * - a taxa do MP fica com o fotógrafo (padrão de mercado; ver docs).
 * Preço, comissão e repasse são sempre calculados aqui — nada vem do navegador.
 * Confirmação por três caminhos (todos idempotentes): resposta do cartão, webhook
 * `payment` e reconsulta do MP enquanto o comprador olha a tela do pedido.
 */
@Injectable()
export class VendasService {
  private readonly logger = new Logger(VendasService.name);
  private readonly webUrl: string;
  private readonly fotografoUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoCliente,
    private readonly credenciais: CredenciaisVendedorService,
    private readonly licencas: LicencasService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL').replace(/\/$/, '');
    this.fotografoUrl = config.get('FOTOGRAFO_URL').replace(/\/$/, '');
  }

  // --- pedido ---------------------------------------------------------------------

  async criarPedido(dto: CriarPedidoDto) {
    const galeria = await this.prisma.galeria.findFirst({
      where: {
        id: dto.galeriaId,
        status: 'PUBLICADA',
        excluidoEm: null,
        conta: { excluidoEm: null, status: { not: 'BLOQUEADA' } },
      },
    });
    if (!galeria) throw new NaoEncontradoExcecao('Galeria');
    if (galeria.encerraEm && galeria.encerraEm <= new Date()) {
      throw new PedidoIndisponivelExcecao('Esta galeria foi encerrada.');
    }
    if (galeria.modoVenda !== 'AVULSO') {
      throw new PedidoIndisponivelExcecao('Esta galeria não vende fotos avulsas.');
    }
    if (
      galeria.visibilidade === 'PRIVADA' &&
      (!dto.codigo || dto.codigo.trim().toUpperCase() !== galeria.codigoAcesso)
    ) {
      throw new DominioExcecao('CODIGO_INVALIDO', 'Código da galeria inválido.', HttpStatus.FORBIDDEN);
    }
    // já busca (e renova, se preciso) as credenciais: a public_key tem que existir pro cartão
    await this.credenciais.obter(galeria.contaId);

    const fotos = await this.prisma.foto.findMany({
      where: { id: { in: dto.fotoIds }, galeriaId: galeria.id, status: 'ATIVA', altaKey: { not: null } },
      select: { id: true, precoCentavos: true },
    });
    if (fotos.length !== dto.fotoIds.length) {
      throw new PedidoIndisponivelExcecao(
        'Alguma foto do carrinho não está mais disponível. Volte à galeria e confira.',
      );
    }
    const itens = fotos.map((f) => ({ fotoId: f.id, precoCentavos: f.precoCentavos ?? galeria.precoFotoCentavos ?? 0 }));
    if (itens.some((i) => i.precoCentavos <= 0)) {
      throw new PedidoIndisponivelExcecao('Esta galeria está sem preço definido.');
    }

    const subtotal = itens.reduce((s, i) => s + i.precoCentavos, 0);
    const comissaoPct = galeria.modalidade === 'EVENTO' ? await this.comissaoEvento(galeria.contaId) : 0;
    const comissao = Math.round((subtotal * comissaoPct) / 100);

    const { comprador: c } = dto;
    const comprador = await this.prisma.comprador.upsert({
      where: { email: c.email },
      create: { email: c.email, nome: c.nome, whatsapp: c.whatsapp || null, cpf: c.cpf, aceitouTermosEm: new Date() },
      update: { nome: c.nome, whatsapp: c.whatsapp || null, cpf: c.cpf, aceitouTermosEm: new Date() },
    });

    const pedido = await this.prisma.pedido.create({
      data: {
        contaId: galeria.contaId,
        galeriaId: galeria.id,
        compradorId: comprador.id,
        status: 'ABERTO',
        subtotalCentavos: subtotal,
        totalCentavos: subtotal,
        comissaoPct: new Prisma.Decimal(comissaoPct),
        comissaoCentavos: comissao,
        // provisório: a taxa do MP só se sabe quando o pagamento é aprovado
        repasseCentavos: subtotal - comissao,
        expiraEm: new Date(Date.now() + PEDIDO_VALIDO_MS),
        itens: { create: itens },
      },
      select: { id: true, numero: true },
    });
    return { id: pedido.id, numero: pedido.numero };
  }

  /** Comissão de evento do plano da conta (snapshot no pedido). */
  private async comissaoEvento(contaId: string): Promise<number> {
    const licenca = await this.licencas.atual(contaId);
    const plano = licenca.planoCodigo
      ? await this.prisma.plano.findUnique({ where: { codigo: licenca.planoCodigo }, select: { comissaoEventoPct: true } })
      : null;
    return plano ? Number(plano.comissaoEventoPct) : COMISSAO_PADRAO_PCT;
  }

  private async pedidoParaPagar(pedidoId: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        comprador: true,
        galeria: { select: { titulo: true } },
        pagamentos: { orderBy: { criadoEm: 'desc' } },
      },
    });
    if (!pedido) throw new NaoEncontradoExcecao('Pedido');
    if (pedido.status === 'PAGO') throw new PedidoIndisponivelExcecao('Este pedido já foi pago.');
    if (!['ABERTO', 'AGUARDANDO_PAGAMENTO'].includes(pedido.status)) {
      throw new PedidoIndisponivelExcecao('Este pedido não pode mais ser pago. Volte à galeria e monte de novo.');
    }
    if (pedido.expiraEm && pedido.expiraEm <= new Date() && pedido.status === 'ABERTO') {
      throw new PedidoIndisponivelExcecao('Este pedido expirou. Volte à galeria e monte de novo.');
    }
    return pedido;
  }

  private pagador(nome: string, email: string, cpf: string) {
    const [primeiro, ...resto] = nome.trim().split(/\s+/);
    return {
      email,
      first_name: primeiro,
      last_name: resto.join(' ') || primeiro,
      identification: { type: 'CPF', number: cpf },
    };
  }

  private corpoBase(pedido: { id: string; numero: number; totalCentavos: number; comissaoCentavos: number }, titulo: string) {
    return {
      transaction_amount: reais(pedido.totalCentavos),
      description: `FotoRAW #${pedido.numero} — fotos de ${titulo}`.slice(0, 200),
      external_reference: pedido.id,
      statement_descriptor: 'FOTORAW',
      ...(pedido.comissaoCentavos > 0 ? { application_fee: reais(pedido.comissaoCentavos) } : {}),
      metadata: { pedido_numero: pedido.numero },
    };
  }

  // --- Pix ------------------------------------------------------------------------

  async pagarPix(pedidoId: string) {
    const pedido = await this.pedidoParaPagar(pedidoId);
    // Pix ainda válido: devolve o mesmo (F5, voltar e escolher Pix de novo)
    const pixAberto = pedido.pagamentos.find(
      (p) => p.metodo === 'PIX' && p.status === 'PENDENTE' && p.pixExpiraEm && p.pixExpiraEm > new Date(),
    );
    if (pixAberto) return this.consultar(pedidoId);

    const creds = await this.credenciais.obter(pedido.contaId);
    const expiraEm = new Date(Date.now() + PIX_VALIDO_MS);
    const mp = await this.mp.criarPagamento(
      creds.accessToken,
      {
        ...this.corpoBase(pedido, pedido.galeria.titulo),
        payment_method_id: 'pix',
        date_of_expiration: expiraEm.toISOString().replace('Z', '-00:00'),
        payer: this.pagador(pedido.comprador.nome, pedido.comprador.email, pedido.comprador.cpf ?? ''),
      },
      `pix-${pedido.id}-${pedido.pagamentos.length}`,
    );

    const dadosPix = mp.point_of_interaction?.transaction_data;
    await this.prisma.$transaction([
      this.prisma.pagamento.create({
        data: {
          pedidoId: pedido.id,
          provedor: 'MERCADOPAGO',
          metodo: 'PIX',
          provedorPagamentoId: String(mp.id),
          status: STATUS_DO_MP[mp.status] ?? 'PENDENTE',
          valorCentavos: pedido.totalCentavos,
          pixCopiaCola: dadosPix?.qr_code ?? null,
          pixExpiraEm: mp.date_of_expiration ? new Date(mp.date_of_expiration) : expiraEm,
          splitAplicado: pedido.comissaoCentavos > 0,
          payload: { qrBase64: dadosPix?.qr_code_base64 ?? null, status: mp.status, statusDetalhe: mp.status_detail ?? null },
        },
      }),
      this.prisma.pedido.update({
        where: { id: pedido.id },
        data: { status: 'AGUARDANDO_PAGAMENTO', expiraEm: expiraEm },
      }),
    ]);
    return this.consultar(pedidoId);
  }

  // --- cartão -----------------------------------------------------------------------

  async pagarCartao(pedidoId: string, dto: PagarCartaoDto) {
    const pedido = await this.pedidoParaPagar(pedidoId);
    const creds = await this.credenciais.obter(pedido.contaId);
    const mp = await this.mp.criarPagamento(
      creds.accessToken,
      {
        ...this.corpoBase(pedido, pedido.galeria.titulo),
        token: dto.token,
        installments: dto.parcelas,
        payment_method_id: dto.paymentMethodId,
        ...(dto.issuerId !== undefined && dto.issuerId !== '' ? { issuer_id: Number(dto.issuerId) } : {}),
        payer: { ...this.pagador(pedido.comprador.nome, dto.email, dto.cpf) },
      },
      // o token do cartão é de uso único: mesma chave = mesmo pagamento
      `cartao-${pedido.id}-${dto.token.slice(-16)}`,
    );

    await this.prisma.pagamento.upsert({
      where: { provedorPagamentoId: String(mp.id) },
      create: {
        pedidoId: pedido.id,
        provedor: 'MERCADOPAGO',
        metodo: 'CARTAO',
        provedorPagamentoId: String(mp.id),
        status: STATUS_DO_MP[mp.status] ?? 'PENDENTE',
        valorCentavos: pedido.totalCentavos,
        splitAplicado: pedido.comissaoCentavos > 0,
        payload: { status: mp.status, statusDetalhe: mp.status_detail ?? null },
      },
      update: {},
    });
    if (pedido.status === 'ABERTO') {
      await this.prisma.pedido.update({ where: { id: pedido.id }, data: { status: 'AGUARDANDO_PAGAMENTO' } });
    }
    await this.aplicar(pedido.id, mp);
    const estado = await this.consultar(pedidoId);
    return { ...estado, cartao: { status: mp.status, detalhe: mp.status_detail ?? null } };
  }

  // --- confirmação --------------------------------------------------------------------

  /** Webhook `payment`. Pagamento que não é de venda (ex.: mensalidade) é só registrado. */
  async processarAviso(pagamentoMpId: string): Promise<string> {
    const pagamento = await this.prisma.pagamento.findUnique({
      where: { provedorPagamentoId: pagamentoMpId },
      select: { pedidoId: true, pedido: { select: { contaId: true } } },
    });
    if (!pagamento) return 'payment sem pedido de venda: só registrado';
    const creds = await this.credenciais.obter(pagamento.pedido.contaId);
    const mp = await this.mp.obterPagamento(creds.accessToken, pagamentoMpId);
    return this.aplicar(pagamento.pedidoId, mp);
  }

  /** Aplica o status do MP no pagamento e no pedido. Idempotente. */
  private async aplicar(pedidoId: string, mp: PagamentoMp): Promise<string> {
    const status = STATUS_DO_MP[mp.status] ?? 'PENDENTE';
    await this.prisma.pagamento.updateMany({
      where: { provedorPagamentoId: String(mp.id) },
      data: {
        status,
        ...(status === 'APROVADO' && mp.date_approved ? { aprovadoEm: new Date(mp.date_approved) } : {}),
      },
    });

    if (status === 'APROVADO') return this.confirmarPago(pedidoId, mp);
    if (status === 'ESTORNADO') {
      // devolução/chargeback: o tratamento completo (bloquear download, avisar) é a Fase 6
      await this.prisma.pedido.updateMany({ where: { id: pedidoId, status: 'PAGO' }, data: { status: 'ESTORNADO' } });
      this.logger.warn(`pedido ${pedidoId}: pagamento ${mp.id} ${mp.status}`);
      return `pedido ${pedidoId}: ${mp.status}`;
    }
    return `pedido ${pedidoId}: pagamento ${mp.status}`;
  }

  private async confirmarPago(pedidoId: string, mp: PagamentoMp): Promise<string> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        itens: { select: { fotoId: true } },
        comprador: true,
        galeria: { select: { id: true, titulo: true, conta: { select: { nome: true, email: true } } } },
      },
    });
    if (!pedido) return `pedido ${pedidoId} sumiu`;
    if (pedido.status === 'PAGO') return `pedido #${pedido.numero} já estava pago`;

    // o pagamento tem que ser deste pedido e do valor certo
    if (mp.external_reference !== pedido.id || Math.round(mp.transaction_amount * 100) !== pedido.totalCentavos) {
      this.logger.error(
        `pagamento ${mp.id} não confere com o pedido #${pedido.numero} (ref ${mp.external_reference}, valor ${mp.transaction_amount})`,
      );
      return `pagamento ${mp.id} não confere com o pedido: ignorado`;
    }

    const taxaProvedor = Math.round(
      (mp.fee_details ?? []).filter((f) => f.type === 'mercadopago_fee').reduce((s, f) => s + f.amount, 0) * 100,
    );
    const repasse = pedido.subtotalCentavos - pedido.descontoCentavos - pedido.comissaoCentavos - taxaProvedor;
    const expira = new Date(Date.now() + DOWNLOAD_VALIDO_DIAS * 24 * 60 * 60 * 1000);

    const confirmou = await this.prisma.$transaction(async (tx) => {
      // só um caminho (cartão / webhook / reconsulta) vira o pedido pra PAGO
      const r = await tx.pedido.updateMany({
        where: { id: pedido.id, status: { not: 'PAGO' } },
        data: {
          status: 'PAGO',
          pagoEm: mp.date_approved ? new Date(mp.date_approved) : new Date(),
          taxaProvedorCentavos: taxaProvedor,
          repasseCentavos: repasse,
        },
      });
      if (r.count === 0) return false;
      await tx.download.createMany({
        data: pedido.itens.map((i) => ({
          pedidoId: pedido.id,
          fotoId: i.fotoId,
          compradorId: pedido.compradorId,
          token: randomBytes(24).toString('base64url'),
          expiraEm: expira,
          limiteBaixadas: DOWNLOAD_LIMITE,
        })),
        skipDuplicates: true,
      });
      await tx.galeria.update({
        where: { id: pedido.galeriaId },
        data: { totalVendasCentavos: { increment: pedido.subtotalCentavos } },
      });
      return true;
    });
    if (!confirmou) return `pedido #${pedido.numero} já estava pago`;

    await this.email.enviar(
      emailFotosLiberadas({
        para: pedido.comprador.email,
        nome: pedido.comprador.nome,
        numero: pedido.numero,
        galeria: pedido.galeria.titulo,
        fotografo: pedido.galeria.conta.nome,
        quantidade: pedido.itens.length,
        totalCentavos: pedido.totalCentavos,
        link: `${this.webUrl}/pedido/${pedido.id}`,
        validadeDias: DOWNLOAD_VALIDO_DIAS,
      }),
    );
    await this.email.enviar(
      emailVendaRealizada({
        para: pedido.galeria.conta.email,
        numero: pedido.numero,
        galeria: pedido.galeria.titulo,
        quantidade: pedido.itens.length,
        subtotalCentavos: pedido.subtotalCentavos,
        comissaoCentavos: pedido.comissaoCentavos,
        taxaProvedorCentavos: taxaProvedor,
        repasseCentavos: repasse,
        link: `${this.fotografoUrl}/vendas`,
      }),
    );
    return `pedido #${pedido.numero} pago`;
  }

  // --- tela do pedido -------------------------------------------------------------------

  /** O que a página /pedido/:id mostra. Enquanto espera, reconsulta o MP de vez em quando. */
  async consultar(pedidoId: string) {
    let pedido = await this.carregar(pedidoId);
    const pendente = pedido.pagamentos.find((p) => p.status === 'PENDENTE');
    if (
      pedido.status === 'AGUARDANDO_PAGAMENTO' &&
      pendente &&
      Date.now() - pendente.atualizadoEm.getTime() > RECONSULTAR_MP_MS
    ) {
      try {
        await this.prisma.pagamento.update({ where: { id: pendente.id }, data: { atualizadoEm: new Date() } });
        const creds = await this.credenciais.obter(pedido.contaId);
        await this.aplicar(pedido.id, await this.mp.obterPagamento(creds.accessToken, pendente.provedorPagamentoId));
        pedido = await this.carregar(pedidoId);
      } catch (erro) {
        this.logger.warn(`reconsulta do pedido ${pedidoId}: ${erro instanceof Error ? erro.message : erro}`);
      }
    }

    // Pix vencido sem pagamento: o pedido expira (o carrinho continua no navegador)
    if (pedido.status === 'AGUARDANDO_PAGAMENTO' && pedido.expiraEm && pedido.expiraEm <= new Date()) {
      const algumPendenteValido = pedido.pagamentos.some(
        (p) => p.status === 'PENDENTE' && (!p.pixExpiraEm || p.pixExpiraEm > new Date()),
      );
      if (!algumPendenteValido) {
        await this.prisma.pedido.update({ where: { id: pedido.id }, data: { status: 'EXPIRADO' } });
        pedido = await this.carregar(pedidoId);
      }
    }

    const base = this.storage.urlBasePreviews;
    const url = (chave: string | null) => (chave ? `${base.replace(/\/$/, '')}/${chave}` : null);
    const pix = pedido.pagamentos.find((p) => p.metodo === 'PIX' && p.status === 'PENDENTE');
    const pago = pedido.status === 'PAGO';
    const publicKey = pago ? null : await this.credenciais.publicKey(pedido.contaId);
    const downloads = new Map(pedido.downloads.map((d) => [d.fotoId, d]));

    return {
      id: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      subtotalCentavos: pedido.subtotalCentavos,
      totalCentavos: pedido.totalCentavos,
      expiraEm: pedido.expiraEm,
      pagoEm: pedido.pagoEm,
      galeria: {
        id: pedido.galeriaId,
        titulo: pedido.galeria.titulo,
        slug: pedido.galeria.slug,
        contaSlug: pedido.galeria.conta.slug,
        fotografo: pedido.galeria.conta.nome,
      },
      comprador: { nome: pedido.comprador.nome, email: pedido.comprador.email },
      /** public_key do fotógrafo: o Brick de cartão precisa dela */
      publicKey,
      pix: pix
        ? {
            copiaCola: pix.pixCopiaCola,
            qrBase64: ((pix.payload ?? {}) as { qrBase64?: string | null }).qrBase64 ?? null,
            expiraEm: pix.pixExpiraEm,
          }
        : null,
      ultimaRecusa: pedido.pagamentos[0]?.status === 'RECUSADO',
      itens: pedido.itens.map((i) => {
        const d = pago ? downloads.get(i.fotoId) : undefined;
        return {
          fotoId: i.fotoId,
          numero: i.foto.numeroIdentificacao,
          precoCentavos: i.precoCentavos,
          miniaturaUrl: url(i.foto.thumbKey ?? i.foto.previewKey),
          download: d
            ? { token: d.token, baixadas: d.baixadas, limite: d.limiteBaixadas, expiraEm: d.expiraEm }
            : null,
        };
      }),
    };
  }

  private async carregar(pedidoId: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        comprador: { select: { nome: true, email: true } },
        galeria: { select: { titulo: true, slug: true, conta: { select: { slug: true, nome: true } } } },
        itens: {
          select: {
            fotoId: true,
            precoCentavos: true,
            foto: { select: { numeroIdentificacao: true, thumbKey: true, previewKey: true } },
          },
        },
        pagamentos: { orderBy: { criadoEm: 'desc' } },
        downloads: true,
      },
    });
    if (!pedido) throw new NaoEncontradoExcecao('Pedido');
    return pedido;
  }

  // --- download -------------------------------------------------------------------------

  /** Link temporário do original em alta. Conta como uma baixada. */
  async baixar(token: string) {
    const d = await this.prisma.download.findUnique({
      where: { token },
      include: {
        pedido: { select: { numero: true, status: true } },
        foto: { select: { altaKey: true, fotoIdDesktop: true } },
      },
    });
    if (!d || d.pedido.status !== 'PAGO' || !d.foto.altaKey) throw new NaoEncontradoExcecao('Download');
    if (d.expiraEm <= new Date()) {
      throw new DominioExcecao('DOWNLOAD_EXPIRADO', 'O prazo deste download acabou. Fale com o fotógrafo.', HttpStatus.GONE);
    }
    const r = await this.prisma.download.updateMany({
      where: { id: d.id, baixadas: { lt: d.limiteBaixadas } },
      data: { baixadas: { increment: 1 }, ultimoDownloadEm: new Date() },
    });
    if (r.count === 0) {
      throw new DominioExcecao(
        'LIMITE_DOWNLOADS',
        `Esta foto já foi baixada ${d.limiteBaixadas} vezes. Fale com o fotógrafo se precisar de novo.`,
        HttpStatus.GONE,
      );
    }
    const url = await this.storage.gerarUrlDownloadAssinada(
      this.storage.bucketOriginais,
      d.foto.altaKey,
      15 * 60,
      `fotoraw-${d.pedido.numero}-${d.fotoId.slice(-6)}.jpg`,
    );
    return { url, baixadas: d.baixadas + 1, limite: d.limiteBaixadas };
  }
}
