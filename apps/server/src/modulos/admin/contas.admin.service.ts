import { Injectable } from '@nestjs/common';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { AuthService, type Contexto } from '../auth/auth.service.js';
import { DispositivosRepositorio } from '../auth/repositorios/dispositivos.repositorio.js';
import { LicencasService } from '../licencas/licencas.service.js';
import type { AlterarStatusContaDto, ListarContasDto } from './dto/contas.dto.js';
import { ContasAdminRepositorio } from './repositorios/contas.admin.repositorio.js';
import { type EventoLinhaDoTempo, calcularSaude, rotuloAcao } from './resumo-conta.js';

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
   * Visão 360 pro painel lateral: saúde, uso contra o plano e linha do tempo
   * unificada (conta, logins, desktop, licenças, galerias, vendas, auditoria).
   */
  async resumo(id: string, limite = 15) {
    const m = await this.repo.materiaPrimaResumo(id, limite);
    if (!m.conta) throw new NaoEncontradoExcecao('Conta', id);
    const licenca = await this.licencas.atual(id);

    const porStatus = Object.fromEntries(
      m.galerias.map((g) => [g.status, { total: g._count._all, ultima: g._max.publicadaEm }]),
    );
    const galeriasAtivas = (porStatus.PUBLICADA?.total ?? 0) + (porStatus.PAUSADA?.total ?? 0);
    const ultimaPublicacaoEm =
      m.galeriasPublicadas[0]?.publicadaEm ?? porStatus.PUBLICADA?.ultima ?? null;
    const conectados = m.dispositivos.filter((d) => d.tokensApi.length > 0);
    const ultimoLoginEm = m.logins[0]?._min.criadoEm ?? null;
    const ultimoDesktopEm = m.dispositivos[0]?.ultimoVistoEm ?? null;

    const saude = calcularSaude({
      status: m.conta.status,
      emailVerificado: m.conta.emailVerificadoEm !== null,
      criadoEm: m.conta.criadoEm,
      licenca,
      dispositivos: m.dispositivos.length,
      galeriasPublicadas: m.galeriasPublicadas.length,
      ultimaPublicacaoEm,
      ultimoLoginEm,
      ultimoDesktopEm,
    });

    const eventos: EventoLinhaDoTempo[] = [
      { quando: m.conta.criadoEm, tipo: 'conta', texto: 'Conta criada' },
      ...m.logins.flatMap((l) =>
        l._min.criadoEm
          ? [{ quando: l._min.criadoEm, tipo: 'sessao', texto: 'Entrou no painel' }]
          : [],
      ),
      ...m.dispositivos.map((d) => ({
        quando: d.criadoEm,
        tipo: 'desktop',
        texto: `Desktop conectado — ${d.nome}`,
      })),
      ...m.licencas.map((l) => ({
        quando: l.emitidaEm,
        tipo: 'licenca',
        texto: `Licença ${l.tipo.toLowerCase()} emitida${
          l.motivo ? ` — ${l.motivo.replace(/^plano:[^ ]+ · /, '')}` : ''
        }`,
      })),
      ...m.galeriasPublicadas.map((g) => ({
        quando: g.publicadaEm!,
        tipo: 'galeria',
        texto: `Publicou "${g.titulo}" (${g.totalFotos} fotos)`,
      })),
      ...m.vendas.map((v) => ({
        quando: v.pagoEm ?? new Date(0),
        tipo: 'venda',
        texto: `Venda #${v.numero} — ${reais(v.totalCentavos)} em "${v.galeria.titulo}"`,
      })),
      // a auditoria já cobre criação/e-mail/licença/status; tiramos o que já entrou acima
      ...m.auditorias
        .filter(
          (a) => !['conta.criada', 'licenca.emitir', 'dispositivo.vinculado'].includes(a.acao),
        )
        .map((a) => ({
          quando: a.criadoEm,
          tipo: a.ator?.papel === 'ADMIN' ? 'admin' : 'conta',
          texto: rotuloAcao(a.acao, a.depois),
          ator: a.ator ? a.ator.nome : null,
        })),
    ];
    eventos.sort((a, b) => b.quando.getTime() - a.quando.getTime());
    // vários logins na mesma hora viram um só (F5, troca de aba…)
    const enxutos = eventos.filter(
      (e, i) =>
        e.tipo !== 'sessao' ||
        i === 0 ||
        eventos[i - 1]!.tipo !== 'sessao' ||
        eventos[i - 1]!.quando.getTime() - e.quando.getTime() > 60 * 60 * 1000,
    );

    return {
      conta: {
        id: m.conta.id,
        nome: m.conta.nome,
        email: m.conta.email,
        slug: m.conta.slug,
        status: m.conta.status,
        emailVerificado: m.conta.emailVerificadoEm !== null,
        criadoEm: m.conta.criadoEm,
      },
      licenca,
      saude,
      uso: {
        galeriasAtivas,
        limiteGalerias: licenca.recursos.limite_galerias_ativas,
        fotos: m.armazenamento._count._all,
        armazenamentoMb: Math.round((m.armazenamento._sum.tamanhoAltaBytes ?? 0) / 1_048_576),
        limiteArmazenamentoMb: licenca.recursos.limite_armazenamento_mb,
        dispositivosConectados: conectados.length,
        limiteDispositivos: licenca.recursos.limite_dispositivos,
        vendas30d: {
          pedidos: m.vendas30d._count._all,
          totalCentavos: m.vendas30d._sum.totalCentavos ?? 0,
          comissaoCentavos: m.vendas30d._sum.comissaoCentavos ?? 0,
        },
        ultimoLoginEm,
        ultimoDesktopEm,
        ultimaPublicacaoEm,
      },
      linhaDoTempo: enxutos.slice(0, limite),
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
      depois: { status: dto.status, motivo: dto.motivo, ...revogados },
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

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
