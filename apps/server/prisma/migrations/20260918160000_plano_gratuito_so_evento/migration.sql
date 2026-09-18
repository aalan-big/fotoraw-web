-- Migration 10 — regra do plano gratuito: só vende foto de EVENTO (10% pra plataforma).
-- Ensaio (portfólio, galeria privada com seleção) e gestão do estúdio no desktop
-- (clientes, agenda, contratos, financeiro) ficam no PRO.

ALTER TABLE "planos"
  ADD COLUMN "permite_ensaio" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "permite_gestao_estudio" BOOLEAN NOT NULL DEFAULT false;

UPDATE "planos" SET "permite_ensaio" = true, "permite_gestao_estudio" = true
  WHERE "codigo" IN ('pro_mensal', 'pro_anual');
UPDATE "planos" SET "permite_ensaio" = false, "permite_gestao_estudio" = false, "permite_galeria_privada" = false
  WHERE "codigo" = 'gratuito';

-- licenças já emitidas: o snapshot ganha as chaves novas (trial/assinatura = PRO; o resto = gratuito)
UPDATE "licencas" SET "recursos" = "recursos" || jsonb_build_object(
  'permite_ensaio',         "tipo" IN ('trial', 'assinatura', 'vitalicia'),
  'permite_gestao_estudio', "tipo" IN ('trial', 'assinatura', 'vitalicia')
) WHERE NOT ("recursos" ? 'permite_ensaio');
