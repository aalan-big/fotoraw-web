// Espelho do que o server devolve em /api/publico/galerias.
// Quando packages/contratos existir, isso passa a vir de lá.
export interface GaleriaPublica {
  id: string;
  titulo: string;
  slug: string;
  tipo: 'EVENTO' | 'PRIVADO';
  capaUrl: string | null;
  publicadaEm: string;
  totalFotos: number;
  conta: {
    nome: string;
    slug: string;
  };
}
