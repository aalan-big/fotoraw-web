// Espelho do que o server devolve em /api/publico/galerias.
// Quando packages/contratos existir, isso passa a vir de lá.
export type Modalidade = 'EVENTO' | 'ENSAIO_INTERNO' | 'ENSAIO_EXTERNO';
export type Visibilidade = 'PUBLICA' | 'PRIVADA' | 'PORTFOLIO';

export type Categoria =
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

export const rotuloCategoria: Record<Categoria, string> = {
  CORRIDA_RUA: 'Corrida de rua',
  TRAIL: 'Trail run',
  CICLISMO: 'Ciclismo',
  TRIATLO: 'Triatlo',
  NATACAO: 'Natação',
  ESPORTIVO: 'Esportivo',
  FORMATURA: 'Formatura',
  CASAMENTO: 'Casamento',
  FESTA: 'Festa',
  CORPORATIVO: 'Corporativo',
  GESTANTE: 'Gestante',
  NEWBORN: 'Newborn',
  FAMILIA: 'Família',
  INFANTIL: 'Infantil',
  QUINZE_ANOS: '15 anos',
  CASAL: 'Casal',
  PESSOAL: 'Ensaio pessoal',
  MODA: 'Moda',
  PRODUTO: 'Produto',
  OUTRO: 'Evento',
};

export const rotuloModalidade: Record<Modalidade, string> = {
  EVENTO: 'Evento',
  ENSAIO_INTERNO: 'Ensaio em estúdio',
  ENSAIO_EXTERNO: 'Ensaio externo',
};

export interface GaleriaPublica {
  id: string;
  titulo: string;
  slug: string;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  categoria: Categoria;
  dataEvento: string | null;
  cidade: string | null;
  uf: string | null;
  /** menor preço por foto, em centavos — null quando não vende avulso */
  precoFotoCentavos: number | null;
  capaUrl: string | null;
  publicadaEm: string;
  totalFotos: number;
  conta: {
    nome: string;
    slug: string;
  };
}

// --- GET /api/publico/galerias/:conta/:galeria ---------------------------

export type ModoVenda = 'AVULSO' | 'PACOTE' | 'ENTREGA';
/** ABERTA vende; PAUSADA mostra sem vender; ENCERRADA não mostra fotos */
export type SituacaoGaleria = 'ABERTA' | 'PAUSADA' | 'ENCERRADA';

export interface FotoPublica {
  id: string;
  /** prévia com a marca de proteção (~1000 px) — foto ampliada */
  url: string | null;
  /** miniatura da grade (~480 px) */
  miniaturaUrl: string | null;
  largura: number | null;
  altura: number | null;
  numero: string | null;
  precoCentavos: number | null;
}

export interface GaleriaAberta {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  modalidade: Modalidade;
  visibilidade: Visibilidade;
  categoria: Categoria;
  modoVenda: ModoVenda;
  precoFotoCentavos: number | null;
  fotosIncluidas: number | null;
  precoPacoteCentavos: number | null;
  dataEvento: string | null;
  cidade: string | null;
  uf: string | null;
  capaUrl: string | null;
  publicadaEm: string | null;
  situacao: SituacaoGaleria;
  /** dá pra comprar agora (avulso, aberta, fotógrafo com Mercado Pago conectado) */
  podeComprar: boolean;
  /** avulso aberto, mas o fotógrafo ainda não ativou as vendas */
  vendasEmBreve: boolean;
  /** entrega: o cliente baixa direto */
  podeBaixar: boolean;
  /** pacote: incluídas, quantas ainda saem sem pagar, se aceita extra pago, já escolhidas */
  pacote: { incluidas: number; restantes: number; extrasDisponiveis: boolean; jaEscolhidas: string[] } | null;
  totalFotos: number;
  fotografo: {
    nome: string;
    slug: string;
    logoUrl: string | null;
    whatsapp: string | null;
    instagram: string | null;
  };
  fotos: { itens: FotoPublica[]; total: number; pagina: number; porPagina: number };
}

// --- GET /api/publico/fotografos/:slug -------------------------------------

export interface PerfilFotografo {
  nome: string;
  slug: string;
  bio: string | null;
  logoUrl: string | null;
  capaUrl: string | null;
  whatsapp: string | null;
  instagram: string | null;
  site: string | null;
  cidade: string | null;
  uf: string | null;
  galerias: GaleriaPublica[];
}
