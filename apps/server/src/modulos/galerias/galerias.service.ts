import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { StatusGaleria } from '../../infra/prisma/gerado/client.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import type { ListarGaleriasDto } from './dto/galerias.dto.js';
import { GaleriasRepositorio } from './repositorios/galerias.repositorio.js';

@Injectable()
export class GaleriasService {
  private readonly webUrl: string;

  constructor(
    private readonly repositorio: GaleriasRepositorio,
    private readonly storage: StorageService,
    private readonly auditoria: AuditoriaService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL');
  }

  private montarLinkPublico(slugConta: string, slugGaleria: string): string {
    return `${this.webUrl.replace(/\/$/, '')}/@${slugConta}/${slugGaleria}`;
  }

  async listar(contaId: string, slugConta: string, filtro: ListarGaleriasDto) {
    const resultado = await this.repositorio.listar(contaId, filtro);

    return {
      itens: resultado.itens.map((g) => ({
        id: g.id,
        slug: g.slug,
        titulo: g.titulo,
        descricao: g.descricao,
        modalidade: g.modalidade,
        visibilidade: g.visibilidade,
        categoria: g.categoria,
        modoVenda: g.modoVenda,
        status: g.status,
        capaUrl: this.storage.urlPublicaPreview(g.capaKey),
        codigoAcesso: g.codigoAcesso,
        totalFotos: g.totalFotos,
        totalVendasCentavos: g.totalVendasCentavos,
        dataEvento: g.dataEvento ? g.dataEvento.toISOString().split('T')[0] : null,
        publicadaEm: g.publicadaEm ? g.publicadaEm.toISOString() : null,
        encerraEm: g.encerraEm ? g.encerraEm.toISOString() : null,
        linkPublico: this.montarLinkPublico(slugConta, g.slug),
        criadoEm: g.criadoEm.toISOString(),
      })),
      total: resultado.total,
      pagina: resultado.pagina,
      limite: resultado.limite,
    };
  }

  async obterPorId(id: string, contaId: string, slugConta: string) {
    const g = await this.repositorio.porId(id, contaId);
    if (!g) {
      throw new NotFoundException('Galeria não encontrada');
    }

    return {
      id: g.id,
      slug: g.slug,
      titulo: g.titulo,
      descricao: g.descricao,
      modalidade: g.modalidade,
      visibilidade: g.visibilidade,
      categoria: g.categoria,
      modoVenda: g.modoVenda,
      status: g.status,
      capaUrl: this.storage.urlPublicaPreview(g.capaKey),
      codigoAcesso: g.codigoAcesso,
      temSenha: Boolean(g.senhaHash),
      totalFotos: g.totalFotos,
      totalVendasCentavos: g.totalVendasCentavos,
      precoFotoCentavos: g.precoFotoCentavos,
      fotosIncluidas: g.fotosIncluidas,
      precoPacoteCentavos: g.precoPacoteCentavos,
      permiteDownloadGratis: g.permiteDownloadGratis,
      dataEvento: g.dataEvento ? g.dataEvento.toISOString().split('T')[0] : null,
      cidade: g.cidade,
      uf: g.uf,
      publicadaEm: g.publicadaEm ? g.publicadaEm.toISOString() : null,
      encerraEm: g.encerraEm ? g.encerraEm.toISOString() : null,
      linkPublico: this.montarLinkPublico(slugConta, g.slug),
      criadoEm: g.criadoEm.toISOString(),
      fotos: g.fotos.map((f) => ({
        id: f.id,
        fotoIdDesktop: f.fotoIdDesktop,
        previewUrl: this.storage.urlPublicaPreview(f.previewKey),
        thumbUrl: this.storage.urlPublicaPreview(f.thumbKey),
        largura: f.largura,
        altura: f.altura,
        tamanhoAltaBytes: f.tamanhoAltaBytes,
        numeroIdentificacao: f.numeroIdentificacao,
        precoCentavos: f.precoCentavos,
        ordem: f.ordem,
        status: f.status,
      })),
    };
  }

  async alterarStatus(id: string, contaId: string, novoStatus: StatusGaleria, ip?: string) {
    const galeria = await this.repositorio.porId(id, contaId);
    if (!galeria) {
      throw new NotFoundException('Galeria não encontrada');
    }

    const antesStatus = galeria.status;
    await this.repositorio.atualizarStatus(id, contaId, novoStatus);

    await this.auditoria.registrar({
      acao: 'galeria.status_alterado',
      alvoTipo: 'galeria',
      alvoId: id,
      atorContaId: contaId,
      ip,
      antes: { status: antesStatus },
      depois: { status: novoStatus },
    });

    return { id, status: novoStatus };
  }

  async obterMetricas(contaId: string) {
    return this.repositorio.metricas(contaId);
  }
}
