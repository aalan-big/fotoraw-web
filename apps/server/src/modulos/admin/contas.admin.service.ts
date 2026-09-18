import { Injectable } from '@nestjs/common';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { AuthService, type Contexto } from '../auth/auth.service.js';
import { DispositivosRepositorio } from '../auth/repositorios/dispositivos.repositorio.js';
import { LicencasService } from '../licencas/licencas.service.js';
import type { AlterarStatusContaDto, ListarContasDto } from './dto/contas.dto.js';
import { ContasAdminRepositorio } from './repositorios/contas.admin.repositorio.js';

/** Admin olhando e mexendo nas contas dos fotógrafos. Toda ação vai pra auditoria com o ator. */
@Injectable()
export class ContasAdminService {
  constructor(
    private readonly repo: ContasAdminRepositorio,
    private readonly dispositivos: DispositivosRepositorio,
    private readonly licencas: LicencasService,
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: ListarContasDto) {
    const [itens, total] = await this.repo.listar(filtro);
    return {
      itens: itens.map(({ licencas, _count, ...c }) => ({
        ...c,
        emailVerificado: c.emailVerificadoEm !== null,
        plano: planoDe(licencas[0]?.tipo),
        licenca: licencas[0] ?? null,
        galerias: _count.galerias,
        dispositivos: _count.dispositivos,
      })),
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async detalhe(id: string) {
    const conta = await this.repo.detalhe(id);
    if (!conta) throw new NaoEncontradoExcecao('Conta', id);
    const [licencaAtual, historico, vendas, auditorias] = await Promise.all([
      this.licencas.atual(id),
      this.licencas.historico(id),
      this.repo.resumoVendas(id),
      this.repo.ultimasAuditorias(id),
    ]);
    const { senhaHash: _senha, dispositivos, galerias, _count, ...dados } = conta;
    return {
      conta: { ...dados, emailVerificado: dados.emailVerificadoEm !== null },
      licencaAtual,
      licencas: historico,
      dispositivos: dispositivos.map(({ tokensApi, ...d }) => ({
        ...d,
        conectado: tokensApi.length > 0,
        ultimoUsoEm: tokensApi[0]?.ultimoUsoEm ?? null,
        tokenExpiraEm: tokensApi[0]?.expiraEm ?? null,
      })),
      galerias,
      totais: { galerias: _count.galerias, pedidos: _count.pedidos },
      vendas,
      auditorias,
    };
  }

  /**
   * ATIVA / SUSPENSA (vitrine no ar, publicar bloqueado) / BLOQUEADA (nada funciona —
   * derruba sessões web e tokens do desktop na hora).
   */
  async alterarStatus(admin: Conta, id: string, dto: AlterarStatusContaDto, ctx: Contexto) {
    const antes = await this.repo.porId(id);
    if (!antes) throw new NaoEncontradoExcecao('Conta', id);
    if (antes.status === dto.status) return { conta: antes, alterado: false };

    const depois = await this.repo.alterarStatus(id, dto.status);
    let revogados: { sessoes: number; tokens: number } | null = null;
    if (dto.status === 'BLOQUEADA') revogados = await this.auth.revogarTudo(id);

    await this.auditoria.registrar({
      acao: `conta.${dto.status.toLowerCase()}`,
      alvoTipo: 'conta',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { status: antes.status },
      depois: { status: dto.status, motivo: dto.motivo, ...(revogados ?? {}) },
    });
    return { conta: depois, alterado: true };
  }

  async reenviarVerificacao(admin: Conta, id: string, ctx: Contexto) {
    const conta = await this.repo.porId(id);
    if (!conta) throw new NaoEncontradoExcecao('Conta', id);
    await this.auth.reenviarVerificacao(conta.email);
    await this.auditoria.registrar({
      acao: 'conta.reenviar_verificacao',
      alvoTipo: 'conta',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
    });
  }

  async revogarDispositivo(admin: Conta, contaId: string, dispositivoId: string, ctx: Contexto) {
    const dispositivo = await this.dispositivos.porIdDaConta(contaId, dispositivoId);
    if (!dispositivo) throw new NaoEncontradoExcecao('Dispositivo', dispositivoId);
    const tokens = await this.dispositivos.revogarDispositivo(dispositivoId);
    await this.auditoria.registrar({
      acao: 'dispositivo.revogado',
      alvoTipo: 'dispositivo',
      alvoId: dispositivoId,
      atorContaId: admin.id,
      ip: ctx.ip,
      depois: { contaId, nome: dispositivo.nome, tokensRevogados: tokens, porAdmin: true },
    });
  }
}

function planoDe(tipo: string | undefined): 'gratuito' | 'trial' | 'pro' {
  if (!tipo) return 'gratuito';
  return tipo === 'TRIAL' ? 'trial' : 'pro';
}
