import { HttpStatus, Injectable } from '@nestjs/common';
import { DominioExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta, Plano } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { PlanoNaoEncontradoExcecao } from '../licencas/licencas.excecoes.js';
import { type LicencaAtual, LicencasService } from '../licencas/licencas.service.js';
import type { AssinarPlanoDto, CancelarAssinaturaDto } from './dto/planos.dto.js';
import { PlanosRepositorio } from './repositorios/planos.repositorio.js';

export type PeriodicidadePlano = 'MENSAL' | 'ANUAL' | 'NENHUMA';

export interface PlanoCatalogo {
  id: string;
  codigo: string;
  nome: string;
  precoCentavos: number;
  periodicidade: PeriodicidadePlano;
  comissaoEventoPct: number;
  limiteGaleriasAtivas: number | null;
  limiteFotosPorGaleria: number | null;
  limiteArmazenamentoMb: number | null;
  limiteDispositivos: number | null;
  permiteGaleriaPrivada: boolean;
  permiteEvento: boolean;
  permiteEnsaio: boolean;
  permiteGestaoEstudio: boolean;
  ordem: number;
}

export type StatusAssinaturaFotografo =
  | 'TRIAL'
  | 'ATIVA'
  | 'INADIMPLENTE'
  | 'CANCELADA'
  | 'EXPIRADA';

export interface AssinaturaResumo {
  id: string;
  planoId: string;
  planoCodigo: string;
  planoNome: string;
  precoCentavos: number;
  periodicidade: PeriodicidadePlano;
  status: StatusAssinaturaFotografo;
  inicioEm: string;
  periodoAtualInicio: string;
  periodoAtualFim: string;
  cancelaNoFimDoPeriodo: boolean;
  canceladaEm: string | null;
  /** pedida mas nenhuma fatura paga ainda — o PRO não está liberado */
  aguardandoPagamento: boolean;
}

export type StatusFaturaFotografo =
  | 'PENDENTE'
  | 'PAGA'
  | 'VENCIDA'
  | 'CANCELADA'
  | 'ESTORNADA';

export interface FaturaResumo {
  id: string;
  valorCentavos: number;
  vencimento: string;
  status: StatusFaturaFotografo;
  pagaEm: string | null;
  urlBoletoPix: string | null;
  criadoEm: string;
}

export interface StatusPlanoFotografo {
  licenca: LicencaAtual;
  assinatura: AssinaturaResumo | null;
  faturas: FaturaResumo[];
  planosDisponiveis: PlanoCatalogo[];
}

@Injectable()
export class PlanosService {
  constructor(
    private readonly repo: PlanosRepositorio,
    private readonly licencas: LicencasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  paraCatalogo(p: Plano): PlanoCatalogo {
    return {
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      precoCentavos: p.precoCentavos,
      periodicidade: p.periodicidade as PeriodicidadePlano,
      comissaoEventoPct: Number(p.comissaoEventoPct),
      limiteGaleriasAtivas: p.limiteGaleriasAtivas,
      limiteFotosPorGaleria: p.limiteFotosPorGaleria,
      limiteArmazenamentoMb: p.limiteArmazenamentoMb,
      limiteDispositivos: p.limiteDispositivos,
      permiteGaleriaPrivada: p.permiteGaleriaPrivada,
      permiteEvento: p.permiteEvento,
      permiteEnsaio: p.permiteEnsaio,
      permiteGestaoEstudio: p.permiteGestaoEstudio,
      ordem: p.ordem,
    };
  }

  async listarPlanos(): Promise<PlanoCatalogo[]> {
    const planos = await this.repo.listarPlanosAtivos();
    return planos.map((p) => this.paraCatalogo(p));
  }

  async obterStatus(contaId: string): Promise<StatusPlanoFotografo> {
    const [licencaAtual, assinaturaAtiva, faturas, planos] = await Promise.all([
      this.licencas.atual(contaId),
      this.repo.assinaturaAtivaDaConta(contaId),
      this.repo.listarFaturasDaConta(contaId),
      this.repo.listarPlanosAtivos(),
    ]);

    let assinaturaResumo: AssinaturaResumo | null = null;
    if (assinaturaAtiva) {
      assinaturaResumo = {
        id: assinaturaAtiva.id,
        planoId: assinaturaAtiva.planoId,
        planoCodigo: assinaturaAtiva.plano.codigo,
        planoNome: assinaturaAtiva.plano.nome,
        precoCentavos: assinaturaAtiva.plano.precoCentavos,
        periodicidade: assinaturaAtiva.plano.periodicidade as PeriodicidadePlano,
        status: assinaturaAtiva.status as StatusAssinaturaFotografo,
        inicioEm: assinaturaAtiva.inicioEm.toISOString(),
        periodoAtualInicio: assinaturaAtiva.periodoAtualInicio.toISOString(),
        periodoAtualFim: assinaturaAtiva.periodoAtualFim.toISOString(),
        cancelaNoFimDoPeriodo: assinaturaAtiva.cancelaNoFimDoPeriodo,
        canceladaEm: assinaturaAtiva.canceladaEm ? assinaturaAtiva.canceladaEm.toISOString() : null,
        aguardandoPagamento: !assinaturaAtiva.faturas.some((f) => f.status === 'PAGA'),
      };
    }

    const faturasResumo: FaturaResumo[] = faturas.map((f) => ({
      id: f.id,
      valorCentavos: f.valorCentavos,
      vencimento: f.vencimento.toISOString(),
      status: f.status as StatusFaturaFotografo,
      pagaEm: f.pagaEm ? f.pagaEm.toISOString() : null,
      urlBoletoPix: f.urlBoletoPix,
      criadoEm: f.criadoEm.toISOString(),
    }));

    return {
      licenca: licencaAtual,
      assinatura: assinaturaResumo,
      faturas: faturasResumo,
      planosDisponiveis: planos.map((p) => this.paraCatalogo(p)),
    };
  }

  async assinar(
    conta: Conta,
    dto: AssinarPlanoDto,
    ctx: Contexto,
  ): Promise<StatusPlanoFotografo> {
    const plano = await this.repo.planoPorCodigo(dto.planoCodigo);
    if (!plano || !plano.ativo) {
      throw new PlanoNaoEncontradoExcecao(dto.planoCodigo);
    }

    const aberta = await this.repo.assinaturaAtivaDaConta(conta.id);
    if (aberta?.faturas.some((f) => f.status === 'PAGA')) {
      // troca de plano com assinatura já paga: ajuste proporcional fica com o suporte por enquanto
      throw new DominioExcecao(
        'TROCA_DE_PLANO_PELO_SUPORTE',
        'Você já tem uma assinatura paga. Para trocar de plano, fale com o suporte.',
        HttpStatus.CONFLICT,
      );
    }
    if (aberta?.planoId === plano.id) return this.obterStatus(conta.id);

    // Sem cobrança automática ainda (Mercado Pago entra no passo 6): o pedido nasce com a
    // fatura PENDENTE e o PRO só é liberado quando ela for paga — nunca na hora.
    const novaAssinatura = await this.repo.criarAssinaturaAguardandoPagamento(conta.id, plano);

    await this.auditoria.registrar({
      acao: 'assinatura.pedido_site',
      alvoTipo: 'assinatura',
      alvoId: novaAssinatura.id,
      atorContaId: conta.id,
      ip: ctx.ip,
      depois: { plano: plano.codigo, precoCentavos: plano.precoCentavos },
    });

    return this.obterStatus(conta.id);
  }

  async cancelar(
    conta: Conta,
    dto: CancelarAssinaturaDto,
    ctx: Contexto,
  ): Promise<StatusPlanoFotografo> {
    const assinatura = await this.repo.assinaturaAtivaDaConta(conta.id);
    if (!assinatura) {
      throw new DominioExcecao(
        'SEM_ASSINATURA_ATIVA',
        'Nenhuma assinatura ativa encontrada para cancelamento.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (assinatura.cancelaNoFimDoPeriodo) {
      return this.obterStatus(conta.id);
    }

    await this.repo.cancelarNoFimDoPeriodo(assinatura.id, dto.motivo);

    await this.auditoria.registrar({
      acao: 'assinatura.cancelar_no_fim',
      alvoTipo: 'assinatura',
      alvoId: assinatura.id,
      atorContaId: conta.id,
      ip: ctx.ip,
      depois: {
        motivo: dto.motivo ?? 'Cancelamento solicitado pelo fotógrafo no painel',
        terminaEm: assinatura.periodoAtualFim.toISOString(),
      },
    });

    return this.obterStatus(conta.id);
  }

  async reativar(conta: Conta, ctx: Contexto): Promise<StatusPlanoFotografo> {
    const assinatura = await this.repo.assinaturaAtivaDaConta(conta.id);
    if (!assinatura) {
      throw new DominioExcecao(
        'SEM_ASSINATURA_ATIVA',
        'Nenhuma assinatura ativa encontrada para reativação.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!assinatura.cancelaNoFimDoPeriodo) {
      return this.obterStatus(conta.id);
    }

    await this.repo.reativarAssinatura(assinatura);

    await this.auditoria.registrar({
      acao: 'assinatura.reativar',
      alvoTipo: 'assinatura',
      alvoId: assinatura.id,
      atorContaId: conta.id,
      ip: ctx.ip,
      depois: {
        assinaturaId: assinatura.id,
      },
    });

    return this.obterStatus(conta.id);
  }
}
