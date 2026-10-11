-- Migration 16 — toda venda de EVENTO paga comissão, em qualquer plano (dono, 2026-10-11).
-- Com 0% no PRO/Business, o fotógrafo que mais vende migraria pra lá e pagaria só a mensalidade.
-- O 0% fica só pro ensaio (entrega ao cliente). Pedidos já pagos guardam o snapshot e não mudam.
--   Gratuito 10% · Evento 7% · PRO 5% · Business 3%

UPDATE "planos" SET "comissao_evento_pct" = 5.00, "atualizado_em" = now()
WHERE "codigo" = 'pro_mensal';

UPDATE "planos" SET "comissao_evento_pct" = 3.00, "atualizado_em" = now()
WHERE "codigo" = 'business_mensal';
