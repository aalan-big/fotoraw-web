/** Catálogo público (GET /publico/planos) — espelha PlanoCatalogo do server. */
export interface PlanoPublico {
  id: string;
  codigo: string;
  nome: string;
  precoCentavos: number;
  periodicidade: 'MENSAL' | 'ANUAL' | 'NENHUMA';
  comissaoEventoPct: number;
  limiteGaleriasAtivas: number | null;
  limiteFotosPorGaleria: number | null;
  limiteArmazenamentoMb: number | null;
  limiteDispositivos: number | null;
  permiteGaleriaPrivada: boolean;
  permiteEvento: boolean;
  permiteEnsaio: boolean;
  permiteGestaoEstudio: boolean;
  ordem: number;
}
