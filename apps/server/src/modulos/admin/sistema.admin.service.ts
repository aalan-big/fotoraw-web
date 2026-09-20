import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import type { Env } from '../../config/env.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta, Prisma } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Contexto } from '../auth/auth.service.js';
import { SaudeService } from '../saude/saude.service.js';
import type { ListarAuditoriaDto, ListarSyncDto, ListarWebhooksDto } from './dto/sistema.dto.js';
import { ROTULO_ACAO, rotuloAcao } from './resumo-conta.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const INICIO = Date.now();

/** Auditoria completa e o "painel de instrumentos" da plataforma. */
@Injectable()
export class SistemaAdminService {
  private readonly emailConfigurado: boolean;
  private readonly storageConfigurado: boolean;
  private readonly ambiente: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saude: SaudeService,
    private readonly auditoria: AuditoriaService,
    config: ConfigService<Env, true>,
  ) {
    this.emailConfigurado = (config.get('RESEND_API_KEY') ?? '').length > 0;
    const chaveStorage = config.get('STORAGE_ACCESS_KEY') ?? '';
    this.storageConfigurado = chaveStorage.length > 0 && chaveStorage !== 'placeholder';
    this.ambiente = config.get('NODE_ENV');
  }

  // ---- auditoria --------------------------------------------------------------

  async listarAuditoria(f: ListarAuditoriaDto) {
    const where: Prisma.AuditoriaWhereInput = {
      ...(f.atorId ? { atorContaId: f.atorId } : {}),
      ...(f.ator === 'sistema' ? { atorContaId: null } : {}),
      ...(f.ator === 'admin' ? { ator: { papel: 'ADMIN' } } : {}),
      ...(f.ator === 'fotografo' ? { ator: { papel: 'FOTOGRAFO' } } : {}),
      ...(f.acao
        ? f.acao.endsWith('.')
          ? { acao: { startsWith: f.acao } }
          : { acao: f.acao }
        : {}),
      ...(f.alvoTipo ? { alvoTipo: f.alvoTipo } : {}),
      ...(f.alvoId ? { alvoId: f.alvoId } : {}),
      ...(f.de || f.ate
        ? {
            criadoEm: {
              ...(f.de ? { gte: f.de } : {}),
              ...(f.ate ? { lt: new Date(f.ate.getTime() + DIA_MS) } : {}),
            },
          }
        : {}),
    };
    const [itens, total] = await this.prisma.$transaction([
      this.prisma.auditoria.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (f.pagina - 1) * f.porPagina,
        take: f.porPagina,
        include: { ator: { select: { id: true, nome: true, email: true, papel: true } } },
      }),
      this.prisma.auditoria.count({ where }),
    ]);
    // alvo "conta" ganha nome pra linkar; os outros tipos o admin acha pelo id
    const contaIds = itens.filter((a) => a.alvoTipo === 'conta').map((a) => a.alvoId);
    const contas = contaIds.length
      ? await this.prisma.conta.findMany({
          where: { id: { in: contaIds } },
          select: { id: true, nome: true, slug: true },
        })
      : [];
    const nome = new Map(contas.map((c) => [c.id, c]));
    return {
      itens: itens.map((a) => ({
        ...a,
        rotulo: rotuloAcao(a.acao, a.depois),
        alvoConta: a.alvoTipo === 'conta' ? (nome.get(a.alvoId) ?? null) : null,
      })),
      total,
      pagina: f.pagina,
      porPagina: f.porPagina,
    };
  }

  /** As ações que já aconteceram, com rótulo e quantidade — alimenta o filtro. */
  async acoesAuditoria() {
    const grupos = await this.prisma.auditoria.groupBy({
      by: ['acao'],
      _count: { _all: true },
      orderBy: { acao: 'asc' },
    });
    return grupos.map((g) => ({
      acao: g.acao,
      rotulo: ROTULO_ACAO[g.acao] ?? g.acao,
      total: g._count._all,
    }));
  }

  // ---- sistema ----------------------------------------------------------------

  async saudeGeral() {
    const [
      banco,
      webhooksErro,
      webhooksPendentes,
      syncErro,
      syncTravado,
      ultimoWebhook,
      ultimoSync,
    ] = await Promise.all([
      this.saude.verificar(),
      this.prisma.webhookRecebido.count({ where: { erro: { not: null } } }),
      this.prisma.webhookRecebido.count({ where: { processadoEm: null, erro: null } }),
      this.prisma.syncLote.count({ where: { status: 'ERRO' } }),
      // lote recebido/processando há mais de 30 min = travou
      this.prisma.syncLote.count({
        where: {
          status: { in: ['RECEBIDO', 'PROCESSANDO'] },
          iniciadoEm: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
      }),
      this.prisma.webhookRecebido.findFirst({
        orderBy: { criadoEm: 'desc' },
        select: { criadoEm: true },
      }),
      this.prisma.syncLote.findFirst({
        orderBy: { iniciadoEm: 'desc' },
        select: { iniciadoEm: true },
      }),
    ]);
    return {
      ambiente: this.ambiente,
      versaoNode: process.version,
      noArHaSegundos: Math.round((Date.now() - INICIO) / 1000),
      memoriaMb: Math.round(process.memoryUsage().rss / 1_048_576),
      banco: banco.banco,
      email: this.emailConfigurado ? 'configurado' : 'so_log',
      storage: this.storageConfigurado ? 'configurado' : 'ausente',
      webhooks: {
        comErro: webhooksErro,
        pendentes: webhooksPendentes,
        ultimoEm: ultimoWebhook?.criadoEm ?? null,
      },
      sync: { comErro: syncErro, travados: syncTravado, ultimoEm: ultimoSync?.iniciadoEm ?? null },
    };
  }

  async listarWebhooks(f: ListarWebhooksDto) {
    const where: Prisma.WebhookRecebidoWhereInput = {
      ...(f.provedor ? { provedor: f.provedor } : {}),
      ...(f.situacao === 'erro' ? { erro: { not: null } } : {}),
      ...(f.situacao === 'pendente' ? { processadoEm: null, erro: null } : {}),
      ...(f.situacao === 'ok' ? { processadoEm: { not: null }, erro: null } : {}),
    };
    const [itens, total] = await this.prisma.$transaction([
      this.prisma.webhookRecebido.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (f.pagina - 1) * f.porPagina,
        take: f.porPagina,
      }),
      this.prisma.webhookRecebido.count({ where }),
    ]);
    return { itens, total, pagina: f.pagina, porPagina: f.porPagina };
  }

  /**
   * Volta o webhook pra fila: limpa erro/processado. Quem processa é o consumidor
   * do provedor (passo 6 do fotógrafo); até lá, "reprocessar" só o deixa pendente.
   */
  async reprocessarWebhook(admin: Conta, id: string, ctx: Contexto) {
    const w = await this.prisma.webhookRecebido.findUnique({ where: { id } });
    if (!w) throw new NaoEncontradoExcecao('Webhook', id);
    const depois = await this.prisma.webhookRecebido.update({
      where: { id },
      data: { erro: null, processadoEm: null },
    });
    await this.auditoria.registrar({
      acao: 'webhook.reprocessar',
      alvoTipo: 'webhook',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { erro: w.erro, processadoEm: w.processadoEm?.toISOString() ?? null },
      depois: { provedor: w.provedor, tipo: w.tipo, eventoRef: w.eventoRef },
    });
    return depois;
  }

  async listarSync(f: ListarSyncDto) {
    const where: Prisma.SyncLoteWhereInput = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.contaId ? { contaId: f.contaId } : {}),
    };
    const [itens, total] = await this.prisma.$transaction([
      this.prisma.syncLote.findMany({
        where,
        orderBy: { iniciadoEm: 'desc' },
        skip: (f.pagina - 1) * f.porPagina,
        take: f.porPagina,
        include: {
          conta: { select: { id: true, nome: true, slug: true } },
          galeria: { select: { id: true, titulo: true, slug: true } },
        },
      }),
      this.prisma.syncLote.count({ where }),
    ]);
    return { itens, total, pagina: f.pagina, porPagina: f.porPagina };
  }
}
