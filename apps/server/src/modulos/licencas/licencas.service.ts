import { Injectable, Logger } from '@nestjs/common';
import type { Licenca } from '../../infra/prisma/gerado/client.js';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { gerarChaveLicenca } from './chave.js';
import {
  LicencaEncerradaExcecao,
  OutraLicencaAtivaExcecao,
  PlanoNaoEncontradoExcecao,
  ValidadeObrigatoriaExcecao,
} from './licencas.excecoes.js';
import { type RecursosLicenca, recursosDoPlano } from './recursos-licenca.js';
import { LicencasRepositorio } from './repositorios/licencas.repositorio.js';

/** O que o desktop e o painel recebem. `plano` é o código do plano de origem. */
export interface LicencaAtual {
  /** null = está no plano gratuito (sem licença emitida) */
  id: string | null;
  chave: string | null;
  plano: 'gratuito' | 'trial' | 'pro';
  tipo: Licenca['tipo'] | null;
  status: 'ATIVA';
  validaAte: Date | null;
  /** dias até vencer; null = não vence */
  diasRestantes: number | null;
  recursos: RecursosLicenca;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Licença = direito de uso (docs/banco-de-dados.md §3.2). Regras:
 *  - cadastro emite um TRIAL com os limites do PRO por `trial_dias` (config, padrão 14);
 *  - vencida, é marcada EXPIRADA na leitura seguinte e a conta cai no `gratuito`;
 *  - sem licença ativa a conta é `gratuito` — não persiste nada, só devolve os limites do plano.
 */
@Injectable()
export class LicencasService {
  private readonly logger = new Logger(LicencasService.name);

  constructor(private readonly repo: LicencasRepositorio) {}

  /** Chamado no cadastro. Nunca lança: cadastro sem trial é melhor que cadastro quebrado. */
  async emitirTrial(contaId: string): Promise<Licenca | null> {
    try {
      if (await this.repo.jaTeveTrial(contaId)) return null;
      const pro = await this.repo.planoPorCodigo('pro_mensal');
      if (!pro) {
        this.logger.warn('Plano pro_mensal não existe — trial não emitido');
        return null;
      }
      const dias = await this.repo.configuracao<number>('trial_dias', 14);
      return await this.repo.emitir({
        contaId,
        chave: gerarChaveLicenca(),
        tipo: 'TRIAL',
        validaAte: new Date(Date.now() + dias * DIA_MS),
        recursos: { ...recursosDoPlano(pro) },
        motivo: `trial de ${dias} dias no cadastro`,
      });
    } catch (erro) {
      this.logger.error(
        `Falha ao emitir trial da conta ${contaId}`,
        erro instanceof Error ? erro.stack : String(erro),
      );
      return null;
    }
  }

  /**
   * Emissão manual pelo admin (cortesia, vitalícia, trial estendido). Os limites
   * vêm do plano-base com ajustes; a licença ativa anterior vira REVOGADA.
   */
  async emitirManual(dados: {
    contaId: string;
    tipo: 'CORTESIA' | 'VITALICIA' | 'TRIAL';
    planoBaseId: string;
    recursos?: Partial<RecursosLicenca>;
    validaAte?: Date | null;
    motivo: string;
    emitidaPorId: string;
  }): Promise<{ nova: Licenca; revogadas: number }> {
    const plano = await this.repo.planoPorId(dados.planoBaseId);
    if (!plano) throw new PlanoNaoEncontradoExcecao(dados.planoBaseId);
    if (dados.tipo !== 'VITALICIA' && !dados.validaAte) throw new ValidadeObrigatoriaExcecao();
    const recursos: RecursosLicenca = { ...recursosDoPlano(plano), ...dados.recursos };
    return this.repo.emitirSubstituindo(
      {
        contaId: dados.contaId,
        chave: gerarChaveLicenca(),
        tipo: dados.tipo,
        validaAte: dados.tipo === 'VITALICIA' ? null : dados.validaAte,
        recursos: { ...recursos },
        motivo: `plano:${plano.id} · ${dados.motivo}`,
        emitidaPorId: dados.emitidaPorId,
      },
      'substituída por nova emissão',
    );
  }

  /** suspensa ↔ ativa, ou revogada (definitivo). Reativar só se não houver outra ativa. */
  async alterarStatus(
    id: string,
    status: 'ATIVA' | 'SUSPENSA' | 'REVOGADA',
    motivo?: string,
  ): Promise<{ antes: Licenca; depois: Licenca }> {
    const antes = await this.repo.porId(id);
    if (!antes) throw new NaoEncontradoExcecao('Licença', id);
    if (antes.status === 'REVOGADA' || antes.status === 'EXPIRADA') {
      throw new LicencaEncerradaExcecao(antes.status);
    }
    if (status === 'ATIVA') {
      const ativa = await this.repo.ativaMaisRecente(antes.contaId);
      if (ativa && ativa.id !== id) throw new OutraLicencaAtivaExcecao(ativa.chave);
    }
    const depois = await this.repo.alterarStatus(id, status, motivo);
    return { antes, depois };
  }

  historico(contaId: string): Promise<Licenca[]> {
    return this.repo.historico(contaId);
  }

  listar(filtro: Parameters<LicencasRepositorio['listar']>[0]) {
    return this.repo.listar(filtro);
  }

  async atual(contaId: string): Promise<LicencaAtual> {
    let licenca = await this.repo.ativaMaisRecente(contaId);
    if (licenca?.validaAte && licenca.validaAte.getTime() < Date.now()) {
      await this.repo.marcarExpirada(licenca.id);
      licenca = null;
    }
    if (licenca) {
      return {
        id: licenca.id,
        chave: licenca.chave,
        plano: licenca.tipo === 'TRIAL' ? 'trial' : 'pro',
        tipo: licenca.tipo,
        status: 'ATIVA',
        validaAte: licenca.validaAte,
        diasRestantes: licenca.validaAte
          ? Math.max(0, Math.ceil((licenca.validaAte.getTime() - Date.now()) / DIA_MS))
          : null,
        recursos: licenca.recursos as unknown as RecursosLicenca,
      };
    }
    return this.gratuito();
  }

  private async gratuito(): Promise<LicencaAtual> {
    const plano = await this.repo.planoPorCodigo('gratuito');
    return {
      id: null,
      chave: null,
      plano: 'gratuito',
      tipo: null,
      status: 'ATIVA',
      validaAte: null,
      diasRestantes: null,
      recursos: plano ? recursosDoPlano(plano) : RECURSOS_MINIMOS,
    };
  }
}

/** Se o seed dos planos sumir, ninguém fica sem publicar — mas bem limitado. */
const RECURSOS_MINIMOS: RecursosLicenca = {
  limite_galerias_ativas: 1,
  limite_fotos_por_galeria: 200,
  limite_armazenamento_mb: 2048,
  limite_dispositivos: 1,
  permite_evento: true,
  permite_ensaio: false,
  permite_galeria_privada: false,
  permite_gestao_estudio: false,
};
