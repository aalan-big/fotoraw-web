import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toDataURL } from 'qrcode';
import { DominioExcecao } from '../../comum/excecoes/dominio.excecao.js';
import type { Env } from '../../config/env.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { Codigo2faInvalidoExcecao } from '../auth/auth.excecoes.js';
import type { Contexto } from '../auth/auth.service.js';
import { SenhaService } from '../auth/senha/senha.service.js';
import {
  cifrarSegredo,
  decifrarSegredo,
  gerarCodigosRecuperacao,
  gerarSegredoTotp,
  hashCodigoRecuperacao,
  urlOtpauth,
  validarCodigoTotp,
} from '../auth/totp.js';

export class TwoFaJaAtivoExcecao extends DominioExcecao {
  constructor() {
    super('2FA_JA_ATIVO', 'A verificação em duas etapas já está ativa', HttpStatus.CONFLICT);
  }
}
export class TwoFaNaoIniciadoExcecao extends DominioExcecao {
  constructor() {
    super('2FA_NAO_INICIADO', 'Gere o QR code primeiro');
  }
}
export class SenhaErradaExcecao extends DominioExcecao {
  constructor() {
    super('SENHA_ERRADA', 'Senha atual incorreta', HttpStatus.UNAUTHORIZED);
  }
}

/**
 * 2FA do próprio admin (TOTP). Ativar = gerar segredo (cifrado) + QR → confirmar
 * com um código do app → 8 códigos de recuperação (mostrados uma vez). Desativar
 * pede senha + código. Tudo auditado.
 */
@Injectable()
export class SegurancaAdminService {
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly senha: SenhaService,
    private readonly auditoria: AuditoriaService,
    config: ConfigService<Env, true>,
  ) {
    this.jwtSecret = config.get('JWT_SECRET');
  }

  async estado(conta: Conta) {
    const atual = await this.prisma.conta.findUniqueOrThrow({
      where: { id: conta.id },
      select: { totpAtivadoEm: true, totpSegredo: true, codigosRecuperacao: true },
    });
    return {
      ativo: atual.totpAtivadoEm !== null,
      ativadoEm: atual.totpAtivadoEm,
      /** segredo gerado mas ainda não confirmado */
      pendente: atual.totpSegredo !== null && atual.totpAtivadoEm === null,
      codigosRestantes: atual.codigosRecuperacao.length,
    };
  }

  /** Passo 1: gera (ou regenera) o segredo e devolve o QR. Não liga nada ainda. */
  async iniciar(conta: Conta) {
    const atual = await this.prisma.conta.findUniqueOrThrow({
      where: { id: conta.id },
      select: { totpAtivadoEm: true },
    });
    if (atual.totpAtivadoEm) throw new TwoFaJaAtivoExcecao();
    const segredo = gerarSegredoTotp();
    await this.prisma.conta.update({
      where: { id: conta.id },
      data: { totpSegredo: cifrarSegredo(segredo, this.jwtSecret) },
    });
    const otpauth = urlOtpauth(segredo, conta.email);
    return { segredo, otpauth, qr: await toDataURL(otpauth, { margin: 1, width: 220 }) };
  }

  /** Passo 2: o código do app bate → 2FA ligado + códigos de recuperação. */
  async confirmar(conta: Conta, codigo: string, ctx: Contexto) {
    const atual = await this.prisma.conta.findUniqueOrThrow({
      where: { id: conta.id },
      select: { totpAtivadoEm: true, totpSegredo: true },
    });
    if (atual.totpAtivadoEm) throw new TwoFaJaAtivoExcecao();
    if (!atual.totpSegredo) throw new TwoFaNaoIniciadoExcecao();
    if (!validarCodigoTotp(decifrarSegredo(atual.totpSegredo, this.jwtSecret), codigo)) {
      throw new Codigo2faInvalidoExcecao();
    }
    const codigos = gerarCodigosRecuperacao();
    await this.prisma.conta.update({
      where: { id: conta.id },
      data: { totpAtivadoEm: new Date(), codigosRecuperacao: codigos.map(hashCodigoRecuperacao) },
    });
    await this.auditoria.registrar({
      acao: '2fa.ativado',
      alvoTipo: 'conta',
      alvoId: conta.id,
      atorContaId: conta.id,
      ip: ctx.ip,
    });
    return { codigos };
  }

  /** Novos códigos de recuperação (os antigos deixam de valer). Pede o código do app. */
  async novosCodigos(conta: Conta, codigo: string, ctx: Contexto) {
    await this.exigirCodigo(conta.id, codigo);
    const codigos = gerarCodigosRecuperacao();
    await this.prisma.conta.update({
      where: { id: conta.id },
      data: { codigosRecuperacao: codigos.map(hashCodigoRecuperacao) },
    });
    await this.auditoria.registrar({
      acao: '2fa.codigos_regenerados',
      alvoTipo: 'conta',
      alvoId: conta.id,
      atorContaId: conta.id,
      ip: ctx.ip,
    });
    return { codigos };
  }

  /** Desligar pede senha E código — ninguém desliga com a sessão roubada. */
  async desativar(conta: Conta, senha: string, codigo: string, ctx: Contexto) {
    const atual = await this.prisma.conta.findUniqueOrThrow({
      where: { id: conta.id },
      select: { senhaHash: true },
    });
    if (!(await this.senha.conferir(atual.senhaHash, senha))) throw new SenhaErradaExcecao();
    await this.exigirCodigo(conta.id, codigo);
    await this.prisma.conta.update({
      where: { id: conta.id },
      data: { totpSegredo: null, totpAtivadoEm: null, codigosRecuperacao: [] },
    });
    await this.auditoria.registrar({
      acao: '2fa.desativado',
      alvoTipo: 'conta',
      alvoId: conta.id,
      atorContaId: conta.id,
      ip: ctx.ip,
    });
  }

  private async exigirCodigo(contaId: string, codigo: string) {
    const atual = await this.prisma.conta.findUniqueOrThrow({
      where: { id: contaId },
      select: { totpAtivadoEm: true, totpSegredo: true },
    });
    if (!atual.totpAtivadoEm || !atual.totpSegredo) throw new TwoFaNaoIniciadoExcecao();
    if (!validarCodigoTotp(decifrarSegredo(atual.totpSegredo, this.jwtSecret), codigo)) {
      throw new Codigo2faInvalidoExcecao();
    }
  }
}
