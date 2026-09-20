export type Modalidade = 'EVENTO' | 'ENSAIO_INTERNO' | 'ENSAIO_EXTERNO';
export type Visibilidade = 'PUBLICA' | 'PRIVADA' | 'PORTFOLIO';
export type ModoVenda = 'AVULSO' | 'PACOTE' | 'ENTREGA';
export type StatusGaleria = 'RASCUNHO' | 'PUBLICADA' | 'PAUSADA' | 'ENCERRADA';
export type StatusFoto = 'ATIVA' | 'OCULTA';

export type CategoriaGaleria =
  | 'CORRIDA_RUA'
  | 'TRAIL'
  | 'CICLISMO'
  | 'TRIATLO'
  | 'NATACAO'
  | 'ESPORTIVO'
  | 'FORMATURA'
  | 'CASAMENTO'
  | 'FESTA'
  | 'CORPORATIVO'
  | 'GESTANTE'
  | 'NEWBORN'
  | 'FAMILIA'
  | 'INFANTIL'
  | 'QUINZE_ANOS'
  | 'CASAL'
  | 'PESSOAL'
  | 'MODA'
  | 'PRODUTO'
  | 'OUTRO';

export interface GaleriaResumo {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  categoria: CategoriaGaleria;
  modoVenda: ModoVenda;
  status: StatusGaleria;
  capaUrl: string | null;
  codigoAcesso: string | null;
  totalFotos: number;
  totalVendasCentavos: number;
  dataEvento: string | null;
  publicadaEm: string | null;
  encerraEm: string | null;
  linkPublico: string;
  criadoEm: string;
}

export interface FotoResumo {
  id: string;
  fotoIdDesktop: string;
  previewUrl: string;
  thumbUrl: string | null;
  largura: number | null;
  altura: number | null;
  numeroIdentificacao: string | null;
  precoCentavos: number | null;
  ordem: number;
  status: StatusFoto;
}

export interface GaleriaDetalhe extends GaleriaResumo {
  fotosIncluidas: number | null;
  precoFotoCentavos: number | null;
  precoPacoteCentavos: number | null;
  permiteDownloadGratis: boolean;
  cidade: string | null;
  uf: string | null;
  fotos: FotoResumo[];
}
