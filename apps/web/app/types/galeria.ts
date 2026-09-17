// Espelho do que o server devolve em /api/publico/galerias.
// Quando packages/contratos existir, isso passa a vir de lá.
export type CategoriaEvento =
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
  | 'OUTRO';

export const rotuloCategoria: Record<CategoriaEvento, string> = {
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
  OUTRO: 'Evento',
};

export interface GaleriaPublica {
  id: string;
  titulo: string;
  slug: string;
  tipo: 'EVENTO' | 'PRIVADO';
  categoria: CategoriaEvento;
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
