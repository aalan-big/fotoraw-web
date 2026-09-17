import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import type { Categoria, Modalidade, Visibilidade } from '../../infra/prisma/gerado/client.js';
import { urlPublica } from '../../infra/storage/urls.js';
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
  /** menor preço por foto, em centavos — null quando não vende avulso */
  precoFotoCentavos: number | null;
  /** URL pública da capa (montada a partir da chave no bucket) */
  capaUrl: string | null;
  publicadaEm: Date | null;
  totalFotos: number;
  conta: { nome: string; slug: string };
}

@Injectable()
export class PublicoService {
  constructor(
    private readonly galerias: GaleriasPublicasRepositorio,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async listarGalerias(dto: ListarGaleriasDto): Promise<GaleriaPublica[]> {
    const base = this.config.get('STORAGE_PREVIEWS_URL_PUBLICA');
    const linhas = await this.galerias.listarVitrine(dto);
    return linhas.map(({ capaKey, ...g }) => ({ ...g, capaUrl: urlPublica(base, capaKey) }));
  }
}
