/**
 * Snapshot dos limites do plano gravado em `licencas.recursos` na emissão.
 * O desktop lê daqui (não do plano), por isso as chaves são snake_case como no
 * banco e no Python. `null` = sem limite.
 */
export interface RecursosLicenca {
  limite_galerias_ativas: number | null;
  limite_fotos_por_galeria: number | null;
  limite_armazenamento_mb: number | null;
  limite_dispositivos: number | null;
  permite_galeria_privada: boolean;
  permite_evento: boolean;
}

export function recursosDoPlano(plano: {
  limiteGaleriasAtivas: number | null;
  limiteFotosPorGaleria: number | null;
  limiteArmazenamentoMb: number | null;
  limiteDispositivos: number | null;
  permiteGaleriaPrivada: boolean;
  permiteEvento: boolean;
}): RecursosLicenca {
  return {
    limite_galerias_ativas: plano.limiteGaleriasAtivas,
    limite_fotos_por_galeria: plano.limiteFotosPorGaleria,
    limite_armazenamento_mb: plano.limiteArmazenamentoMb,
    limite_dispositivos: plano.limiteDispositivos,
    permite_galeria_privada: plano.permiteGaleriaPrivada,
    permite_evento: plano.permiteEvento,
  };
}
