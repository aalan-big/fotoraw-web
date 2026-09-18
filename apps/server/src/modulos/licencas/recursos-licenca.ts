/**
 * Snapshot dos limites do plano gravado em `licencas.recursos` na emissão.
 * O desktop lê daqui (não do plano), por isso as chaves são snake_case como no
 * banco e no Python. `null` = sem limite.
 *
 * Regra de negócio (dono, 2026-09-18): o plano gratuito só vende foto de EVENTO,
 * pagando 10% à plataforma. Ensaio (portfólio, galeria privada com seleção) e a
 * gestão do estúdio no desktop (clientes, agenda, contratos, financeiro) são PRO.
 */
export interface RecursosLicenca {
  limite_galerias_ativas: number | null;
  limite_fotos_por_galeria: number | null;
  limite_armazenamento_mb: number | null;
  limite_dispositivos: number | null;
  /** vender foto de evento (todo plano tem) */
  permite_evento: boolean;
  /** publicar ensaio: portfólio e entrega ao cliente */
  permite_ensaio: boolean;
  /** galeria privada com seleção do cliente (parte do ensaio) */
  permite_galeria_privada: boolean;
  /** módulos de gestão no desktop */
  permite_gestao_estudio: boolean;
}

export function recursosDoPlano(plano: {
  limiteGaleriasAtivas: number | null;
  limiteFotosPorGaleria: number | null;
  limiteArmazenamentoMb: number | null;
  limiteDispositivos: number | null;
  permiteEvento: boolean;
  permiteEnsaio: boolean;
  permiteGaleriaPrivada: boolean;
  permiteGestaoEstudio: boolean;
}): RecursosLicenca {
  return {
    limite_galerias_ativas: plano.limiteGaleriasAtivas,
    limite_fotos_por_galeria: plano.limiteFotosPorGaleria,
    limite_armazenamento_mb: plano.limiteArmazenamentoMb,
    limite_dispositivos: plano.limiteDispositivos,
    permite_evento: plano.permiteEvento,
    permite_ensaio: plano.permiteEnsaio,
    permite_galeria_privada: plano.permiteGaleriaPrivada,
    permite_gestao_estudio: plano.permiteGestaoEstudio,
  };
}
