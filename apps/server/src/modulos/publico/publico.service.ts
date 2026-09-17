import { Injectable } from '@nestjs/common';
import type { Categoria, Modalidade, Visibilidade } from '../../infra/prisma/gerado/client.js';
import type { ListarGaleriasDto } from './dto/listar-galerias.dto.js';
import { GaleriasPublicasRepositorio } from './repositorios/galerias-publicas.repositorio.js';

export interface GaleriaPublica {
  id: string;
  titulo: string;
  slug: string;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  categoria: Categoria;
  dataEvento: Date | null;
  cidade: string | null;
  uf: string | null;
  /** menor preço por foto, em reais (string decimal) — null quando não vende avulso */
  precoFoto: string | null;
  capaUrl: string | null;
  publicadaEm: Date | null;
  totalFotos: number;
  conta: { nome: string; slug: string };
}

@Injectable()
export class PublicoService {
  constructor(private readonly galerias: GaleriasPublicasRepositorio) {}

  async listarGalerias(dto: ListarGaleriasDto): Promise<GaleriaPublica[]> {
    const linhas = await this.galerias.listarVitrine(dto);
    return linhas.map(({ _count, precoFoto, ...g }) => ({
      ...g,
      precoFoto: precoFoto?.toFixed(2) ?? null,
      totalFotos: _count.fotos,
    }));
  }
}
