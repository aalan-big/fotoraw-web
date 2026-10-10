-- Migration 13 — tabela de planos fechada pelo dono em 2026-10-10 (pesquisa de mercado:
-- Banlek, Fotop, Alboom, Pixieset). Só mensal por ora; cobrança automática no cartão (MP).
--   Gratuito  R$ 0      5 GB   10%  só evento
--   Evento    R$ 80   200 GB    7%  só evento (novo)
--   PRO       R$ 59,90 15 GB    0%  evento + ensaio + galeria privada + gestão
--   Business  R$ 120  200 GB    0%  tudo do PRO
-- Licenças já emitidas guardam o snapshot antigo; o admin reemite pelo plano se quiser.

UPDATE "planos" SET
  "limite_armazenamento_mb" = 5120,
  "comissao_evento_pct" = 10.00,
  "ordem" = 1,
  "atualizado_em" = now()
WHERE "codigo" = 'gratuito';

UPDATE "planos" SET
  "nome" = 'PRO',
  "preco_centavos" = 5990,
  "limite_armazenamento_mb" = 15360,
  "comissao_evento_pct" = 0.00,
  "ordem" = 3,
  "atualizado_em" = now()
WHERE "codigo" = 'pro_mensal';

-- anual sai de venda (não apaga: assinaturas antigas apontam pra ele)
UPDATE "planos" SET "ativo" = false, "ordem" = 9, "atualizado_em" = now()
WHERE "codigo" = 'pro_anual';

INSERT INTO "planos" ("id", "codigo", "nome", "preco_centavos", "periodicidade", "comissao_evento_pct",
  "limite_galerias_ativas", "limite_fotos_por_galeria", "limite_armazenamento_mb", "limite_dispositivos",
  "permite_galeria_privada", "permite_evento", "permite_ensaio", "permite_gestao_estudio",
  "ativo", "ordem", "atualizado_em")
VALUES
  (gen_random_uuid(), 'evento_mensal',   'Evento',   8000,  'mensal', 7.00,
    NULL, NULL, 204800, 3, false, true, false, false, true, 2, now()),
  (gen_random_uuid(), 'business_mensal', 'Business', 12000, 'mensal', 0.00,
    NULL, NULL, 204800, 3, true,  true, true,  true,  true, 4, now())
ON CONFLICT ("codigo") DO NOTHING;
