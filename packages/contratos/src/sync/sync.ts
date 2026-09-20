import type {
  CategoriaGaleria,
  Modalidade,
  ModoVenda,
  Visibilidade,
} from '../galerias/galerias.js';

export interface FotoSyncItem {
  fotoIdDesktop: string;
  largura?: number;
  altura?: number;
  tamanhoAltaBytes?: number;
  numeroIdentificacao?: string;
  precoCentavos?: number;
  ordem?: number;
  temAlta?: boolean;
}

export interface IniciarSyncLotePayload {
  chaveIdempotencia: string;
  ensaioIdDesktop: string;
  titulo: string;
  descricao?: string;
  slug?: string;
  modalidade: Modalidade;
  visibilidade?: Visibilidade;
  categoria?: CategoriaGaleria;
  modoVenda: ModoVenda;
  precoFotoCentavos?: number;
  fotosIncluidas?: number;
  precoPacoteCentavos?: number;
  permiteDownloadGratis?: boolean;
  codigoAcesso?: string;
  senha?: string;
  dataEvento?: string;
  cidade?: string;
  uf?: string;
  encerraEm?: string;
  fotos: FotoSyncItem[];
}

export interface UrlUploadPresigned {
  fotoIdDesktop: string;
  tipo: 'preview' | 'alta';
  urlPut: string;
  chave: string;
}

export interface IniciarSyncLoteResposta {
  loteId: string;
  galeriaId: string;
  totalItens: number;
  urlsUpload: UrlUploadPresigned[];
}

export interface ConfirmarFotoItem {
  fotoIdDesktop: string;
  previewKey: string;
  altaKey?: string;
  largura?: number;
  altura?: number;
  tamanhoAltaBytes?: number;
}

export interface ConfirmarSyncLotePayload {
  fotos: ConfirmarFotoItem[];
  capaKey?: string;
}

export interface ConfirmarSyncLoteResposta {
  loteId: string;
  galeriaId: string;
  status: 'CONCLUIDO' | 'ERRO';
  totalFotos: number;
  linkPublico: string;
}
