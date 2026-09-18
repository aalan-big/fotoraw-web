import { Injectable } from '@nestjs/common';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta, Perfil } from '../../infra/prisma/gerado/client.js';
import { CredenciaisInvalidasExcecao } from '../auth/auth.excecoes.js';
import {
  AuthService,
  type ContaPublica,
  type Contexto,
  contaPublica,
} from '../auth/auth.service.js';
import { DispositivosRepositorio } from '../auth/repositorios/dispositivos.repositorio.js';
import { SenhaService } from '../auth/senha/senha.service.js';
import { type LicencaAtual, LicencasService } from '../licencas/licencas.service.js';
import type { AtualizarContaDto } from './dto/atualizar-conta.dto.js';
import type { PerfilDto } from './dto/perfil.dto.js';
import { ContasRepositorio } from './repositorios/contas.repositorio.js';

export interface Eu {
  conta: ContaPublica;
  perfil: Perfil | null;
  licenca: LicencaAtual;
  /** o que o Início mostra como "falta fazer" */
  pendencias: Pendencia[];
}

export type Pendencia = 'verificar_email' | 'completar_perfil' | 'licenca_vencendo';

export interface DispositivoResumo {
  id: string;
  nome: string;
  versaoApp: string | null;
  ultimoVistoEm: Date;
  criadoEm: Date;
  conectado: boolean;
  ultimoUsoEm: Date | null;
  tokenExpiraEm: Date | null;
}

/** A conta logada mexendo nela mesma (`/me`). Admin mexendo nos outros é outro módulo. */
@Injectable()
export class ContasService {
  constructor(
    private readonly repo: ContasRepositorio,
    private readonly dispositivos: DispositivosRepositorio,
    private readonly auth: AuthService,
    private readonly senha: SenhaService,
    private readonly licencas: LicencasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async eu(conta: Conta): Promise<Eu> {
    const [perfil, licenca] = await Promise.all([
      this.repo.perfil(conta.id),
      this.licencas.atual(conta.id),
    ]);
    const pendencias: Pendencia[] = [];
    if (!conta.emailVerificadoEm) pendencias.push('verificar_email');
    if (!perfil?.cidade || !perfil.whatsapp) pendencias.push('completar_perfil');
    if (licenca.diasRestantes !== null && licenca.diasRestantes <= 7) {
      pendencias.push('licenca_vencendo');
    }
    return { conta: contaPublica(conta), perfil, licenca, pendencias };
  }

  /** Nome muda na hora; e-mail novo fica pendente até o clique no link. */
  async atualizar(conta: Conta, dto: AtualizarContaDto) {
    let atual = conta;
    if (dto.nome !== undefined && dto.nome !== conta.nome) {
      atual = await this.repo.atualizarNome(conta.id, dto.nome);
    }
    let emailPendente: string | null = null;
    if (dto.email !== undefined && dto.email !== conta.email) {
      await this.auth.pedirTrocaEmail(conta, dto.email);
      emailPendente = dto.email;
    }
    return { conta: contaPublica(atual), emailPendente };
  }

  /** Troca a senha e abre uma sessão nova (as antigas caem — inclusive a que fez o pedido). */
  async alterarSenha(conta: Conta, senhaAtual: string, novaSenha: string, ctx: Contexto) {
    await this.auth.alterarSenha(conta, senhaAtual, novaSenha, ctx);
    return this.auth.login({ email: conta.email, senha: novaSenha }, ctx);
  }

  perfil(conta: Conta): Promise<Perfil | null> {
    return this.repo.perfil(conta.id);
  }

  async salvarPerfil(conta: Conta, dto: PerfilDto, ctx: Contexto): Promise<Perfil> {
    const antes = await this.repo.perfil(conta.id);
    const perfil = await this.repo.salvarPerfil(conta.id, conta.nome, dto);
    if (
      antes &&
      dto.taxasParaCliente !== undefined &&
      dto.taxasParaCliente !== antes.taxasParaCliente
    ) {
      // decisão financeira: quem paga a taxa do provedor
      await this.auditoria.registrar({
        acao: 'perfil.taxas_para_cliente',
        alvoTipo: 'conta',
        alvoId: conta.id,
        atorContaId: conta.id,
        ip: ctx.ip,
        antes: { taxasParaCliente: antes.taxasParaCliente },
        depois: { taxasParaCliente: dto.taxasParaCliente },
      });
    }
    return perfil;
  }

  async listarDispositivos(conta: Conta): Promise<DispositivoResumo[]> {
    const lista = await this.dispositivos.listarDaConta(conta.id);
    return lista.map(({ tokensApi, ...d }) => ({
      id: d.id,
      nome: d.nome,
      versaoApp: d.versaoApp,
      ultimoVistoEm: d.ultimoVistoEm,
      criadoEm: d.criadoEm,
      conectado: tokensApi.length > 0,
      ultimoUsoEm: tokensApi[0]?.ultimoUsoEm ?? null,
      tokenExpiraEm: tokensApi[0]?.expiraEm ?? null,
    }));
  }

  /** O desktop dessa máquina volta pra tela de login na próxima chamada. */
  async revogarDispositivo(conta: Conta, id: string, ctx: Contexto): Promise<void> {
    const dispositivo = await this.dispositivos.porIdDaConta(conta.id, id);
    if (!dispositivo) throw new NaoEncontradoExcecao('Dispositivo', id);
    const revogados = await this.dispositivos.revogarDispositivo(id);
    await this.auditoria.registrar({
      acao: 'dispositivo.revogado',
      alvoTipo: 'dispositivo',
      alvoId: id,
      atorContaId: conta.id,
      ip: ctx.ip,
      depois: { nome: dispositivo.nome, tokensRevogados: revogados },
    });
  }

  /** Exclusão lógica: pede a senha, derruba sessões e tokens, anonimiza o e-mail. */
  async excluir(conta: Conta, senha: string, ctx: Contexto): Promise<void> {
    if (!(await this.senha.conferir(conta.senhaHash, senha))) {
      throw new CredenciaisInvalidasExcecao();
    }
    await this.auth.revogarTudo(conta.id);
    await this.repo.excluir(conta.id);
    await this.auditoria.registrar({
      acao: 'conta.excluida',
      alvoTipo: 'conta',
      alvoId: conta.id,
      atorContaId: conta.id,
      ip: ctx.ip,
      antes: { email: conta.email, slug: conta.slug },
    });
  }
}
