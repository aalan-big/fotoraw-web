import { Injectable } from '@nestjs/common';
import type { ListarGaleriasDto } from './dto/listar-galerias.dto.js';
import { GaleriasPublicasRepositorio } from './repositorios/galerias-publicas.repositorio.js';

export interface GaleriaPublica {
  id: string;
  titulo: string;
  slug: string;
  tipo: 'EVENTO' | 'PRIVADO';
  capaUrl: string | null;
  publicadaEm: Date | null;
  totalFotos: number;
  conta: { nome: string; slug: string };
}

@Injectable()
export class PublicoService {
  constructor(private readonly galerias: GaleriasPublicasRepositorio) {}

  async listarGalerias(dto: ListarGaleriasDto): Promise<GaleriaPublica[]> {
    const linhas = await this.galerias.listarPublicadas(dto);
    return linhas.map(({ _count, ...g }) => ({ ...g, totalFotos: _count.fotos }));
  }
}
