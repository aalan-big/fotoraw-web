import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DominioExcecao } from '../../../comum/excecoes/dominio.excecao.js';
import { cifrar, decifrar } from '../../../comum/utils/cifra.js';
import type { Env } from '../../../config/env.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

export interface CredenciaisVendedor {
  /** access_token OAuth do fotógrafo: o pagamento sai na conta dele */
  accessToken: string;
  /** public_key dele: o Brick de cartão da vitrine tokeniza com ela */
  publicKey: string | null;
  /** user_id no MP (collector_id) */
  collectorId: string;
}

/** renova antes de vencer (o token do MP dura 180 dias) */
const RENOVAR_COM_ANTECEDENCIA_MS = 7 * 24 * 60 * 60 * 1000;

export class VendasIndisponiveisExcecao extends DominioExcecao {
  constructor() {
    super(
      'VENDAS_INDISPONIVEIS',
      'Este fotógrafo ainda não ativou as vendas. Tente de novo mais tarde.',
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Credenciais Mercado Pago do fotógrafo (conectadas no painel → Financeiro via OAuth),
 * decifradas na hora de vender. Renova o token quando está perto de vencer — e também
 * quando falta a public_key (conexões feitas antes de ela ser guardada).
 */
@Injectable()
export class CredenciaisVendedorService {
  private readonly logger = new Logger(CredenciaisVendedorService.name);
  private readonly chaveCifra: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    // mesma chave do FinanceiroService (que grava os tokens)
    this.chaveCifra =
      this.config.get('CHAVE_CIFRA_TOKENS') || 'chave-secreta-padrao-dev-fotoraw-2026';
  }

  /** Só diz se dá pra vender (sem decifrar nada) — usado pela vitrine. */
  async vendeOnline(contaId: string): Promise<boolean> {
    const conexao = await this.prisma.conexaoPagamento.findFirst({
      where: { contaId, provedor: 'MERCADOPAGO', revogadoEm: null },
      select: { id: true },
    });
    return !!conexao;
  }

  /** Só a public_key guardada (sem renovar nada) — a tela do pedido consulta a toda hora. */
  async publicKey(contaId: string): Promise<string | null> {
    const conexao = await this.prisma.conexaoPagamento.findFirst({
      where: { contaId, provedor: 'MERCADOPAGO', revogadoEm: null },
      select: { publicKey: true },
    });
    return conexao?.publicKey ?? null;
  }

  async obter(contaId: string): Promise<CredenciaisVendedor> {
    const conexao = await this.prisma.conexaoPagamento.findFirst({
      where: { contaId, provedor: 'MERCADOPAGO', revogadoEm: null },
    });
    if (!conexao) throw new VendasIndisponiveisExcecao();

    const venceLogo =
      !!conexao.tokenExpiraEm &&
      conexao.tokenExpiraEm.getTime() - Date.now() < RENOVAR_COM_ANTECEDENCIA_MS;
    if ((venceLogo || !conexao.publicKey) && conexao.refreshTokenCifrado) {
      const renovada = await this.renovar(conexao.id, decifrar(conexao.refreshTokenCifrado, this.chaveCifra));
      if (renovada) return renovada;
    }
    return {
      accessToken: decifrar(conexao.accessTokenCifrado, this.chaveCifra),
      publicKey: conexao.publicKey,
      collectorId: conexao.provedorUsuarioId,
    };
  }

  /** grant_type=refresh_token. Falhou: segue com o token atual (ainda pode valer). */
  private async renovar(conexaoId: string, refreshToken: string): Promise<CredenciaisVendedor | null> {
    const appId = this.config.get('MERCADOPAGO_APP_ID');
    const segredo = this.config.get('MERCADOPAGO_CLIENT_SECRET');
    if (!appId || !segredo || refreshToken.startsWith('TG_REFRESH_SIMULADO')) return null;
    try {
      const resposta = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: appId,
          client_secret: segredo,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!resposta.ok) {
        this.logger.warn(`refresh OAuth MP falhou: HTTP ${resposta.status} ${(await resposta.text()).slice(0, 200)}`);
        return null;
      }
      const dados = (await resposta.json()) as {
        user_id: number;
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        public_key?: string;
      };
      await this.prisma.conexaoPagamento.update({
        where: { id: conexaoId },
        data: {
          accessTokenCifrado: cifrar(dados.access_token, this.chaveCifra),
          ...(dados.refresh_token
            ? { refreshTokenCifrado: cifrar(dados.refresh_token, this.chaveCifra) }
            : {}),
          tokenExpiraEm: dados.expires_in ? new Date(Date.now() + dados.expires_in * 1000) : null,
          ...(dados.public_key ? { publicKey: dados.public_key } : {}),
        },
      });
      this.logger.log(`token OAuth MP renovado (conexão ${conexaoId})`);
      return {
        accessToken: dados.access_token,
        publicKey: dados.public_key ?? null,
        collectorId: String(dados.user_id),
      };
    } catch (erro) {
      this.logger.warn(`refresh OAuth MP sem resposta: ${erro instanceof Error ? erro.message : erro}`);
      return null;
    }
  }
}
