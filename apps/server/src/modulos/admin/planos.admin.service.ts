import { Injectable } from '@nestjs/common';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta, Plano, Prisma } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Contexto } from '../auth/auth.service.js';
import { LicencasService } from '../licencas/licencas.service.js';
import { LicencasRepositorio } from '../licencas/repositorios/licencas.repositorio.js';
import type { EditarPlanoDto, ReemitirPlanoDto } from './dto/planos.dto.js';

/** Plano como o admin vê: Decimal vira número e vem quantas licenças ativas dependem dele. */
export interface PlanoAdmin extends Omit<Plano, 'comissaoEventoPct'> {
  comissaoEventoPct: number;
  licencasAtivas: number;
}

/**
 * Catálogo de planos. Mudar um plano NÃO muda licenças já emitidas (são
 * snapshot) — pra isso existe `reemitir`, que o admin chama de propósito.
 * Plano nunca é apagado: assinaturas e licenças apontam pra ele; só `ativo`.
 */
@Injectable()
export class PlanosAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licencas: LicencasService,
    private readonly licencasRepo: LicencasRepositorio,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<PlanoAdmin[]> {
    const planos = await this.prisma.plano.findMany({ orderBy: { ordem: 'asc' } });
    return Promise.all(planos.map((p) => this.paraAdmin(p)));
  }

  async editar(admin: Conta, id: string, dto: EditarPlanoDto, ctx: Contexto): Promise<PlanoAdmin> {
    const antes = await this.prisma.plano.findUnique({ where: { id } });
    if (!antes) throw new NaoEncontradoExcecao('Plano', id);

    const depois = await this.prisma.plano.update({ where: { id }, data: dto });
    await this.auditoria.registrar({
      acao: 'plano.editar',
      alvoTipo: 'plano',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: recorte(antes, Object.keys(dto)),
      depois: recorte(depois, Object.keys(dto)),
    });
    return this.paraAdmin(depois);
  }

  /** Aplica os limites atuais do plano nas licenças ATIVAS emitidas a partir dele. */
  async reemitir(admin: Conta, id: string, dto: ReemitirPlanoDto, ctx: Contexto) {
    const plano = await this.prisma.plano.findUnique({ where: { id } });
    if (!plano) throw new NaoEncontradoExcecao('Plano', id);

    const { licencas, atualizadas } = await this.licencas.reemitirDoPlano(id);
    await this.auditoria.registrar({
      acao: 'plano.reemitir',
      alvoTipo: 'plano',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      depois: { motivo: dto.motivo, atualizadas, licencas: licencas.map((l) => l.id) },
    });
    return { atualizadas };
  }

  private async paraAdmin(p: Plano): Promise<PlanoAdmin> {
    const ativas = await this.licencasRepo.ativasDoPlano(p.id);
    return { ...p, comissaoEventoPct: Number(p.comissaoEventoPct), licencasAtivas: ativas.length };
  }
}

/** Só os campos que mudaram entram na auditoria (antes/depois curtos). */
function recorte(plano: Plano, campos: string[]): Prisma.InputJsonObject {
  const r: Record<string, string | number | boolean | null> = {};
  for (const c of campos) {
    const v = (plano as unknown as Record<string, string | number | boolean | null>)[c];
    r[c] = c === 'comissaoEventoPct' ? Number(v) : (v ?? null);
  }
  return r;
}
