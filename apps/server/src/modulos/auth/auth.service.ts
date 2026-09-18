import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import { EmailService } from '../../infra/email/email.service.js';
import type { Conta, PapelConta } from '../../infra/prisma/gerado/client.js';
import {
  ContaBloqueadaExcecao,
  CredenciaisInvalidasExcecao,
  EmailJaCadastradoExcecao,
  LimiteDispositivosExcecao,
  MuitasTentativasExcecao,
  SenhaFracaExcecao,
  SessaoInvalidaExcecao,
  SlugJaUsadoExcecao,
  TokenInvalidoExcecao,
} from './auth.excecoes.js';
import type { CadastroDto } from './dto/cadastro.dto.js';
import { SLUGS_RESERVADOS } from './dto/comum.js';
import type { DispositivoDto } from './dto/dispositivo.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { emailConfirmarTroca, emailRedefinirSenha, emailVerificarConta } from './emails.js';
import { ContasAuthRepositorio } from './repositorios/contas.repositorio.js';
import { DispositivosRepositorio } from './repositorios/dispositivos.repositorio.js';
import { SessoesWebRepositorio } from './repositorios/sessoes-web.repositorio.js';
import { TokensVerificacaoRepositorio } from './repositorios/tokens-verificacao.repositorio.js';
import { LimitadorTentativas } from './senha/limitador-tentativas.js';
import { SenhaService } from './senha/senha.service.js';
import { ehSenhaComum } from './senha/senhas-comuns.js';
import { DIA_MS, MINUTO_MS, daquiA, gerarTokenOpaco, hashToken, novaFamilia } from './tokens.js';

/** O que vai dentro do JWT de acesso. */
export interface JwtPayload {
  sub: string;
  papel: PapelConta;
}

/** Como a conta aparece nas respostas do auth e em `GET /me`. Nunca inclui o hash. */
export interface ContaPublica {
  id: string;
  nome: string;
  email: string;
  slug: string;
  papel: PapelConta;
  status: Conta['status'];
  emailVerificado: boolean;
}

export interface Contexto {
  ip?: string | null;
  userAgent?: string | null;
}

export interface SessaoEmitida {
  acesso: string;
  refresh: string;
  refreshExpiraEm: Date;
  conta: ContaPublica;
}

export const VALIDADE_VERIFICACAO_EMAIL = 2 * DIA_MS;
export const VALIDADE_REDEFINIR_SENHA = 30 * MINUTO_MS;

export function contaPublica(c: Conta): ContaPublica {
  return {
    id: c.id,
    nome: c.nome,
    email: c.email,
    slug: c.slug,
    papel: c.papel,
    status: c.status,
    emailVerificado: c.emailVerificadoEm !== null,
  };
}

/**
 * Identidade da plataforma — docs/fluxos/ambiente-fotografo.md §1.
 * Web (fotógrafo/admin): JWT curto + refresh rotativo em cookie.
 * Desktop: e-mail+senha uma vez → token_api opaco de longa duração.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshDias: number;
  private readonly tokenApiDias: number;
  private readonly fotografoUrl: string;

  constructor(
    private readonly contas: ContasAuthRepositorio,
    private readonly sessoes: SessoesWebRepositorio,
    private readonly tokensVerificacao: TokensVerificacaoRepositorio,
    private readonly dispositivos: DispositivosRepositorio,
    private readonly senha: SenhaService,
    private readonly limitador: LimitadorTentativas,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly auditoria: AuditoriaService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshDias = config.get('SESSAO_REFRESH_DIAS');
    this.tokenApiDias = config.get('TOKEN_API_DIAS');
    this.fotografoUrl = config.get('FOTOGRAFO_URL');
  }

  // ---------------------------------------------------------------------------
  // Cadastro e verificação de e-mail
  // ---------------------------------------------------------------------------

  async cadastrar(dto: CadastroDto, ctx: Contexto): Promise<SessaoEmitida> {
    if (SLUGS_RESERVADOS.has(dto.slug)) throw new SlugJaUsadoExcecao();
    if (ehSenhaComum(dto.senha)) throw new SenhaFracaExcecao();

    const existente = await this.contas.existeEmailOuSlug(dto.email, dto.slug);
    if (existente?.email === dto.email) throw new EmailJaCadastradoExcecao();
    if (existente?.slug === dto.slug) throw new SlugJaUsadoExcecao();

    const conta = await this.contas.criar({
      nome: dto.nome,
      email: dto.email,
      slug: dto.slug,
      senhaHash: await this.senha.hash(dto.senha),
    });

    await this.auditoria.registrar({
      acao: 'conta.criada',
      alvoTipo: 'conta',
      alvoId: conta.id,
      atorContaId: conta.id,
      ip: ctx.ip,
    });
    await this.enviarVerificacaoEmail(conta);

    // já entra logado; sem verificar o e-mail só navega (não publica)
    return this.abrirSessao(conta, ctx);
  }

  /** Reenvio: resposta igual exista a conta ou não. */
  async reenviarVerificacao(email: string): Promise<void> {
    const conta = await this.contas.porEmail(email);
    if (!conta || conta.emailVerificadoEm) return;
    await this.enviarVerificacaoEmail(conta);
  }

  async verificarEmail(token: string, ctx: Contexto): Promise<ContaPublica> {
    const registro = await this.consumirTokenVerificacao(token, 'VERIFICAR_EMAIL');
    const conta = await this.contas.marcarEmailVerificado(registro.contaId);
    await this.auditoria.registrar({
      acao: 'email.verificado',
      alvoTipo: 'conta',
      alvoId: conta.id,
      atorContaId: conta.id,
      ip: ctx.ip,
    });
    return contaPublica(conta);
  }

  /** Troca de e-mail (PATCH /me): guarda o novo em `dados` até o clique no link. */
  async pedirTrocaEmail(conta: Conta, novoEmail: string): Promise<void> {
    if (novoEmail === conta.email) return;
    if (await this.contas.porEmail(novoEmail)) throw new EmailJaCadastradoExcecao();
    const token = gerarTokenOpaco();
    await this.tokensVerificacao.emitir({
      contaId: conta.id,
      tipo: 'TROCAR_EMAIL',
      tokenHash: hashToken(token),
      expiraEm: daquiA(VALIDADE_VERIFICACAO_EMAIL),
      dados: { email: novoEmail },
    });
    await this.email.enviar(
      emailConfirmarTroca(novoEmail, conta.nome, this.link('confirmar-email', token)),
    );
  }

  async confirmarTrocaEmail(token: string, ctx: Contexto): Promise<ContaPublica> {
    const registro = await this.consumirTokenVerificacao(token, 'TROCAR_EMAIL');
    const novoEmail = (registro.dados as { email?: string } | null)?.email;
    if (!novoEmail) throw new TokenInvalidoExcecao();
    if (await this.contas.porEmail(novoEmail)) throw new EmailJaCadastradoExcecao();

    const antes = await this.contas.porId(registro.contaId);
    const conta = await this.contas.atualizarEmail(registro.contaId, novoEmail);
    await this.auditoria.registrar({
      acao: 'email.trocado',
      alvoTipo: 'conta',
      alvoId: conta.id,
      atorContaId: conta.id,
      ip: ctx.ip,
      antes: { email: antes?.email ?? null },
      depois: { email: novoEmail },
    });
    return contaPublica(conta);
  }

  // ---------------------------------------------------------------------------
  // Login web + refresh rotativo
  // ---------------------------------------------------------------------------

  async login(dto: LoginDto, ctx: Contexto): Promise<SessaoEmitida> {
    const conta = await this.autenticar(dto.email, dto.senha);
    return this.abrirSessao(conta, ctx);
  }

  /**
   * Rotação: a sessão apresentada é marcada como usada e outra nasce na mesma família.
   * Se a sessão apresentada JÁ tinha sido usada, alguém tem uma cópia do cookie:
   * revoga a família inteira e derruba os dois.
   */
  async renovar(refresh: string | undefined, ctx: Contexto): Promise<SessaoEmitida> {
    if (!refresh) throw new SessaoInvalidaExcecao();
    const sessao = await this.sessoes.porTokenHash(hashToken(refresh));
    if (!sessao || sessao.revogadaEm || sessao.expiraEm < new Date()) {
      throw new SessaoInvalidaExcecao();
    }
    if (sessao.usadaEm) {
      await this.sessoes.revogarFamilia(sessao.familia);
      await this.auditoria.registrar({
        acao: 'sessao.reuso_detectado',
        alvoTipo: 'conta',
        alvoId: sessao.contaId,
        ip: ctx.ip,
        depois: { familia: sessao.familia },
      });
      this.logger.warn(`Reuso de refresh token — família ${sessao.familia} revogada`);
      throw new SessaoInvalidaExcecao();
    }

    const conta = await this.contas.porId(sessao.contaId);
    if (!conta || conta.status === 'BLOQUEADA') throw new SessaoInvalidaExcecao();

    await this.sessoes.marcarUsada(sessao.id);
    return this.abrirSessao(conta, ctx, sessao.familia);
  }

  async sair(refresh: string | undefined): Promise<void> {
    if (!refresh) return;
    const sessao = await this.sessoes.porTokenHash(hashToken(refresh));
    if (sessao && !sessao.revogadaEm) await this.sessoes.revogarFamilia(sessao.familia);
  }

  // ---------------------------------------------------------------------------
  // Desktop
  // ---------------------------------------------------------------------------

  async vincularDispositivo(dto: DispositivoDto, ctx: Contexto) {
    const conta = await this.autenticar(dto.email, dto.senha);

    const existente = await this.dispositivos.porFingerprint(conta.id, dto.fingerprint);
    if (!existente) {
      const limite = await this.dispositivos.limiteDispositivos(conta.id);
      if (limite !== null && (await this.dispositivos.contarDaConta(conta.id)) >= limite) {
        throw new LimiteDispositivosExcecao(limite);
      }
    }

    const dispositivo = await this.dispositivos.upsert({
      contaId: conta.id,
      fingerprint: dto.fingerprint,
      nome: dto.nomeMaquina,
      versaoApp: dto.versaoApp,
    });

    const token = gerarTokenOpaco();
    const tokenApi = await this.dispositivos.trocarTokenDoDispositivo({
      contaId: conta.id,
      dispositivoId: dispositivo.id,
      nome: dto.nomeMaquina,
      tokenHash: hashToken(token),
      expiraEm: daquiA(this.tokenApiDias * DIA_MS),
    });

    await this.auditoria.registrar({
      acao: existente ? 'dispositivo.reconectado' : 'dispositivo.vinculado',
      alvoTipo: 'dispositivo',
      alvoId: dispositivo.id,
      atorContaId: conta.id,
      ip: ctx.ip,
      depois: { nome: dispositivo.nome, versaoApp: dispositivo.versaoApp },
    });

    return {
      tokenApi: token,
      tokenExpiraEm: tokenApi.expiraEm,
      dispositivo: { id: dispositivo.id, nome: dispositivo.nome },
      conta: contaPublica(conta),
    };
  }

  // ---------------------------------------------------------------------------
  // Senha
  // ---------------------------------------------------------------------------

  /** Sempre responde igual — não revela se o e-mail existe. */
  async recuperarSenha(email: string): Promise<void> {
    const conta = await this.contas.porEmail(email);
    if (!conta || conta.status === 'BLOQUEADA') return;
    const token = gerarTokenOpaco();
    await this.tokensVerificacao.emitir({
      contaId: conta.id,
      tipo: 'REDEFINIR_SENHA',
      tokenHash: hashToken(token),
      expiraEm: daquiA(VALIDADE_REDEFINIR_SENHA),
    });
    await this.email.enviar(
      emailRedefinirSenha(conta.email, conta.nome, this.link('redefinir-senha', token)),
    );
  }

  async redefinirSenha(token: string, novaSenha: string, ctx: Contexto): Promise<void> {
    if (ehSenhaComum(novaSenha)) throw new SenhaFracaExcecao();
    const registro = await this.consumirTokenVerificacao(token, 'REDEFINIR_SENHA');
    await this.trocarSenha(registro.contaId, novaSenha, ctx, 'senha.redefinida');
  }

  /** Conta logada trocando a própria senha (PUT /me/senha). */
  async alterarSenha(conta: Conta, senhaAtual: string, novaSenha: string, ctx: Contexto) {
    if (!(await this.senha.conferir(conta.senhaHash, senhaAtual))) {
      throw new CredenciaisInvalidasExcecao();
    }
    if (ehSenhaComum(novaSenha)) throw new SenhaFracaExcecao();
    await this.trocarSenha(conta.id, novaSenha, ctx, 'senha.alterada');
  }

  /** Trocar senha derruba tudo: sessões web e tokens do desktop (ele pede login uma vez). */
  private async trocarSenha(contaId: string, novaSenha: string, ctx: Contexto, acao: string) {
    await this.contas.atualizarSenha(contaId, await this.senha.hash(novaSenha));
    const sessoes = await this.sessoes.revogarTodasDaConta(contaId);
    const tokens = await this.dispositivos.revogarTodosDaConta(contaId);
    await this.auditoria.registrar({
      acao,
      alvoTipo: 'conta',
      alvoId: contaId,
      atorContaId: contaId,
      ip: ctx.ip,
      depois: { sessoesRevogadas: sessoes, tokensRevogados: tokens },
    });
  }

  // ---------------------------------------------------------------------------
  // internos
  // ---------------------------------------------------------------------------

  /** E-mail + senha → conta. Limita por e-mail (o Throttler limita por IP). Erro genérico. */
  private async autenticar(email: string, senha: string): Promise<Conta> {
    if (this.limitador.bloqueado(email)) throw new MuitasTentativasExcecao();

    const conta = await this.contas.porEmail(email);
    // confere mesmo sem conta pra não vazar pelo tempo de resposta
    const ok = await this.senha.conferir(conta?.senhaHash ?? HASH_FANTASMA, senha);

    if (!conta || !ok) {
      this.limitador.registrarFalha(email);
      throw new CredenciaisInvalidasExcecao();
    }
    if (conta.status === 'BLOQUEADA') throw new ContaBloqueadaExcecao();

    this.limitador.limpar(email);
    return conta;
  }

  private async abrirSessao(conta: Conta, ctx: Contexto, familia?: string): Promise<SessaoEmitida> {
    const refresh = gerarTokenOpaco();
    const refreshExpiraEm = daquiA(this.refreshDias * DIA_MS);
    await this.sessoes.criar({
      contaId: conta.id,
      familia: familia ?? novaFamilia(),
      tokenHash: hashToken(refresh),
      expiraEm: refreshExpiraEm,
      userAgent: ctx.userAgent?.slice(0, 255) ?? null,
      ip: ctx.ip ?? null,
    });
    const payload: JwtPayload = { sub: conta.id, papel: conta.papel };
    return {
      acesso: await this.jwt.signAsync(payload),
      refresh,
      refreshExpiraEm,
      conta: contaPublica(conta),
    };
  }

  private async enviarVerificacaoEmail(conta: Conta): Promise<void> {
    const token = gerarTokenOpaco();
    await this.tokensVerificacao.emitir({
      contaId: conta.id,
      tipo: 'VERIFICAR_EMAIL',
      tokenHash: hashToken(token),
      expiraEm: daquiA(VALIDADE_VERIFICACAO_EMAIL),
    });
    await this.email.enviar(
      emailVerificarConta(conta.email, conta.nome, this.link('verificar-email', token)),
    );
  }

  private async consumirTokenVerificacao(
    token: string,
    tipo: 'VERIFICAR_EMAIL' | 'REDEFINIR_SENHA' | 'TROCAR_EMAIL',
  ) {
    const registro = await this.tokensVerificacao.porTokenHash(hashToken(token));
    if (!registro || registro.tipo !== tipo || registro.usadoEm || registro.expiraEm < new Date()) {
      throw new TokenInvalidoExcecao();
    }
    await this.tokensVerificacao.marcarUsado(registro.id);
    return registro;
  }

  private link(rota: string, token: string): string {
    return `${this.fotografoUrl}/${rota}?token=${token}`;
  }
}

/**
 * Hash argon2id válido de uma senha aleatória — conferido quando o e-mail não existe,
 * só pra gastar o mesmo tempo e não revelar cadastros pela latência.
 */
const HASH_FANTASMA =
  '$argon2id$v=19$m=65536,p=1,t=3$0lyDtNBaYQj00RxjaJxZZQ$A1gO+Fvug6pBI+goiiNPhIg8o3LIYW1QPoZXa5wbdPA';
