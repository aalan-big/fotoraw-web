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
  /** menor preço por foto (string decimal) — null quando não vende avulso */
  precoFoto: string | null;
  capaUrl: string | null;
  publicadaEm: string;
  totalFotos: number;
  conta: {
    nome: string;
    slug: string;
  };
}
