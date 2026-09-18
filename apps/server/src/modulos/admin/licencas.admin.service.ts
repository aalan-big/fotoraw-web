import { Injectable } from '@nestjs/common';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import type { Contexto } from '../auth/auth.service.js';
import { LicencasService } from '../licencas/licencas.service.js';
import type {
  AlterarStatusLicencaDto,
  EmitirLicencaDto,
  ListarLicencasDto,
} from './dto/licencas.dto.js';
import { ContasAdminRepositorio } from './repositorios/contas.admin.repositorio.js';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Emitir, suspender, reativar e revogar licenças — o coração do admin. */
@Injectable()
export class LicencasAdminService {
  constructor(
    private readonly licencas: LicencasService,
    private readonly contas: ContasAdminRepositorio,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: ListarLicencasDto) {
    const [itens, total] = await this.licencas.listar({
      tipo: filtro.tipo,
      status: filtro.status,
      venceAte: filtro.venceEmDias ? new Date(Date.now() + filtro.venceEmDias * DIA_MS) : undefined,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    });
    return { itens, total, pagina: filtro.pagina, porPagina: filtro.porPagina };
  }

  historico(contaId: string) {
    return this.licencas.historico(contaId);
  }

  async emitir(admin: Conta, dto: EmitirLicencaDto, ctx: Contexto) {
    const conta = await this.contas.porId(dto.contaId);
    if (!conta) throw new NaoEncontradoExcecao('Conta', dto.contaId);

    const { nova, revogadas } = await this.licencas.emitirManual({
      contaId: dto.contaId,
      tipo: dto.tipo,
      planoBaseId: dto.planoBaseId,
      recursos: dto.recursos,
      validaAte: dto.validaAte ?? null,
      motivo: dto.motivo,
      emitidaPorId: admin.id,
    });

    await this.auditoria.registrar({
      acao: 'licenca.emitir',
      alvoTipo: 'licenca',
      alvoId: nova.id,
      atorContaId: admin.id,
      ip: ctx.ip,
      depois: {
        contaId: dto.contaId,
        chave: nova.chave,
        tipo: nova.tipo,
        validaAte: nova.validaAte?.toISOString() ?? null,
        recursos: nova.recursos,
        motivo: dto.motivo,
        revogadas,
      },
    });
    return { licenca: nova, revogadas };
  }

  async alterarStatus(admin: Conta, id: string, dto: AlterarStatusLicencaDto, ctx: Contexto) {
    const { antes, depois } = await this.licencas.alterarStatus(id, dto.status, dto.motivo);
    await this.auditoria.registrar({
      acao: `licenca.${dto.status.toLowerCase()}`,
      alvoTipo: 'licenca',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { status: antes.status },
      depois: { status: depois.status, motivo: dto.motivo, contaId: depois.contaId },
    });
    return depois;
  }
}
