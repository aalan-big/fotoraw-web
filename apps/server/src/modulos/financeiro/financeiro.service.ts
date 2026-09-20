import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cifrar } from '../../comum/utils/cifra.js';
import type { Env } from '../../config/env.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { AtualizarTaxasDto } from './dto/financeiro.dto.js';
import { FinanceiroRepositorio } from './repositorios/financeiro.repositorio.js';

@Injectable()
export class FinanceiroService {
  private readonly logger = new Logger(FinanceiroService.name);
  private readonly chaveCifra: string;
  private readonly fotografoUrl: string;

  constructor(
    private readonly repositorio: FinanceiroRepositorio,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.chaveCifra =
      this.config.get('CHAVE_CIFRA_TOKENS') || 'chave-secreta-padrao-dev-fotoraw-2026';
    this.fotografoUrl = this.config.get('FOTOGRAFO_URL');
  }

  private gerarState(contaId: string): string {
    const hash = createHash('sha256')
      .update(contaId + this.chaveCifra)
      .digest('hex')
      .slice(0, 16);
    return `${contaId}:${hash}`;
  }

  private validarState(contaId: string, state: string): boolean {
    const esperado = this.gerarState(contaId);
    return state === esperado;
  }

  async obterSaldo(contaId: string) {
    const [saldos, conexaoMp, taxas] = await Promise.all([
      this.repositorio.obterSaldos(contaId),
      this.repositorio.obterConexao(contaId),
      this.repositorio.obterConfiguracaoTaxas(contaId),
    ]);

    return {
      ...saldos,
      conexaoMercadoPago: {
        conectado: Boolean(conexaoMp),
        rotulo: conexaoMp?.rotulo ?? null,
        provedorUsuarioId: conexaoMp?.provedorUsuarioId ?? null,
        conectadoEm: conexaoMp?.conectadoEm ? conexaoMp.conectadoEm.toISOString() : null,
      },
      configuracao: {
        taxasParaCliente: taxas?.taxasParaCliente ?? false,
        chavePix: taxas?.chavePix ?? null,
        cnpjCpf: taxas?.cnpjCpf ?? null,
      },
    };
  }

  async listarRepasses(contaId: string) {
    const itens = await this.repositorio.listarRepasses(contaId);
    return itens.map((r) => ({
      id: r.id,
      periodoInicio: r.periodoInicio.toISOString().split('T')[0],
      periodoFim: r.periodoFim.toISOString().split('T')[0],
      valorCentavos: r.valorCentavos,
      status: r.status,
      metodo: r.metodo,
      provedorTransferenciaId: r.provedorTransferenciaId,
      pagoEm: r.pagoEm ? r.pagoEm.toISOString() : null,
      comprovanteKey: r.comprovanteKey,
      criadoEm: r.criadoEm.toISOString(),
    }));
  }

  gerarUrlConectarMercadoPago(contaId: string) {
    const appId = this.config.get('MERCADOPAGO_APP_ID');
    const redirectUri = `${this.fotografoUrl.replace(/\/$/, '')}/financeiro/mercado-pago`;
    const state = this.gerarState(contaId);

    if (!appId || appId.trim() === '') {
      return {
        url: null,
        simulado: true,
        redirectUri,
        state,
      };
    }

    const url = `https://auth.mercadopago.com.br/authorization?client_id=${appId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return {
      url,
      simulado: false,
      redirectUri,
      state,
    };
  }

  async processarCallbackMercadoPago(
    contaId: string,
    code: string,
    state: string,
    ip?: string,
  ) {
    if (!this.validarState(contaId, state)) {
      throw new BadRequestException('State de autenticação inválido ou expirado');
    }

    const appId = this.config.get('MERCADOPAGO_APP_ID');
    const clientSecret = this.config.get('MERCADOPAGO_CLIENT_SECRET');
    const redirectUri = `${this.fotografoUrl.replace(/\/$/, '')}/financeiro/mercado-pago`;

    let provedorUsuarioId: string;
    let rotulo: string;
    let accessToken: string;
    let refreshToken: string | null = null;
    let expiraEm: Date | null = null;

    // Modo simulado para dev/test se credenciais reais não estiverem configuradas
    if (!appId || !clientSecret || code.startsWith('simulado')) {
      this.logger.log(`Conexão simulada do Mercado Pago para conta ${contaId}`);
      provedorUsuarioId = `simulado_${Date.now()}`;
      rotulo = 'vendedor-teste@mercadopago.local';
      accessToken = `APP_USR_SIMULADO_${Date.now()}`;
      refreshToken = `TG_REFRESH_SIMULADO_${Date.now()}`;
      expiraEm = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    } else {
      try {
        const resposta = await fetch('https://api.mercadopago.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_secret: clientSecret,
            client_id: appId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!resposta.ok) {
          const detalhe = await resposta.text();
          this.logger.error(`Erro OAuth Mercado Pago: ${detalhe}`);
          throw new BadRequestException('Falha ao autorizar com o Mercado Pago');
        }

        const dados = (await resposta.json()) as {
          user_id: number;
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        };

        provedorUsuarioId = String(dados.user_id);
        rotulo = `Conta MP #${provedorUsuarioId}`;
        accessToken = dados.access_token;
        refreshToken = dados.refresh_token ?? null;
        expiraEm = dados.expires_in
          ? new Date(Date.now() + dados.expires_in * 1000)
          : null;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.error('Falha na comunicação com Mercado Pago', err);
        throw new BadRequestException('Erro de comunicação com o Mercado Pago');
      }
    }

    // Criptografia AES-256-GCM dos tokens antes de gravar
    const accessTokenCifrado = cifrar(accessToken, this.chaveCifra);
    const refreshTokenCifrado = refreshToken ? cifrar(refreshToken, this.chaveCifra) : null;

    await this.repositorio.salvarConexao({
      contaId,
      provedor: 'MERCADOPAGO',
      provedorUsuarioId,
      accessTokenCifrado,
      refreshTokenCifrado,
      tokenExpiraEm: expiraEm,
      rotulo,
    });

    await this.auditoria.registrar({
      acao: 'conexao_pagamento.conectada',
      alvoTipo: 'conexao_pagamento',
      alvoId: provedorUsuarioId,
      atorContaId: contaId,
      ip,
      depois: {
        provedor: 'MERCADOPAGO',
        rotulo,
        conectadoEm: new Date(),
      },
    });

    return {
      conectado: true,
      rotulo,
      provedorUsuarioId,
    };
  }

  async desconectarMercadoPago(contaId: string, ip?: string) {
    const conexao = await this.repositorio.obterConexao(contaId);
    if (!conexao) {
      return { desconectado: true };
    }

    await this.repositorio.revogarConexao(contaId);

    await this.auditoria.registrar({
      acao: 'conexao_pagamento.desconectada',
      alvoTipo: 'conexao_pagamento',
      alvoId: conexao.provedorUsuarioId,
      atorContaId: contaId,
      ip,
    });

    return { desconectado: true };
  }

  async atualizarTaxas(contaId: string, dto: AtualizarTaxasDto, ip?: string) {
    const atualizado = await this.repositorio.atualizarTaxas(contaId, dto);

    await this.auditoria.registrar({
      acao: 'financeiro.taxas_alteradas',
      alvoTipo: 'perfil',
      alvoId: contaId,
      atorContaId: contaId,
      ip,
      depois: {
        taxasParaCliente: atualizado.taxasParaCliente,
        chavePix: atualizado.chavePix,
        cnpjCpf: atualizado.cnpjCpf,
      },
    });

    return {
      taxasParaCliente: atualizado.taxasParaCliente,
      chavePix: atualizado.chavePix,
      cnpjCpf: atualizado.cnpjCpf,
    };
  }
}
