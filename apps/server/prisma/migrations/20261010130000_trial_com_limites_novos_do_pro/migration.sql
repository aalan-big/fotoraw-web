-- Migration 14 — o teste de 14 dias é o PRO. Trials ativos emitidos antes da tabela de
-- 2026-10-10 guardavam o snapshot antigo (200 GB); passam a valer com os limites atuais do
-- pro_mensal (15 GB…). Chave, tipo e validade não mudam. Novos trials já nascem certos
-- (emitirTrial lê o plano na hora).

UPDATE "licencas" l SET
  "recursos" = l."recursos" || jsonb_build_object(
    'limite_galerias_ativas',   p."limite_galerias_ativas",
    'limite_fotos_por_galeria', p."limite_fotos_por_galeria",
    'limite_armazenamento_mb',  p."limite_armazenamento_mb",
    'limite_dispositivos',      p."limite_dispositivos",
    'permite_evento',           p."permite_evento",
    'permite_ensaio',           p."permite_ensaio",
    'permite_galeria_privada',  p."permite_galeria_privada",
    'permite_gestao_estudio',   p."permite_gestao_estudio"
  ),
  "atualizada_em" = now()
FROM "planos" p
WHERE p."codigo" = 'pro_mensal'
  AND l."tipo" = 'trial'
  AND l."status" = 'ativa'
  AND l."motivo" LIKE 'plano:' || p."id" || '%';
