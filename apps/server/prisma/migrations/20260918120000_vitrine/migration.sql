-- Migration 6 — vitrine: galerias, fotos, compradores, pedidos, pagamentos, downloads

-- ---------------------------------------------------------------------------
-- galerias: capa_url -> capa_key; expira_em -> encerra_em; código de acesso; caches; soft-delete
-- ---------------------------------------------------------------------------

ALTER TABLE "galerias" RENAME COLUMN "capa_url" TO "capa_key";
ALTER TABLE "galerias" RENAME COLUMN "expira_em" TO "encerra_em";
ALTER TABLE "galerias"
  ADD COLUMN "codigo_acesso" TEXT,
  ADD COLUMN "permite_download_gratis" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "total_fotos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_vendas_centavos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "excluido_em" TIMESTAMP(3);
CREATE UNIQUE INDEX "galerias_codigo_acesso_key" ON "galerias"("codigo_acesso");
CREATE INDEX "galerias_conta_id_status_idx" ON "galerias"("conta_id", "status");
-- cache inicial
UPDATE "galerias" g SET "total_fotos" = (SELECT count(*) FROM "fotos" f WHERE f."galeria_id" = g."id");

-- ---------------------------------------------------------------------------
-- fotos
-- ---------------------------------------------------------------------------

ALTER TABLE "fotos"
  ADD COLUMN "thumb_key" TEXT,
  ADD COLUMN "tamanho_alta_bytes" INTEGER,
  ADD COLUMN "status" "status_foto" NOT NULL DEFAULT 'ativa';

-- ---------------------------------------------------------------------------
-- compradores: e-mail único, aceite de termos (LGPD)
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "compradores_email_idx";
ALTER TABLE "compradores" ADD COLUMN "aceitou_termos_em" TIMESTAMP(3);
UPDATE "compradores" SET "aceitou_termos_em" = "criado_em";
ALTER TABLE "compradores" ALTER COLUMN "aceitou_termos_em" SET NOT NULL;
CREATE UNIQUE INDEX "compradores_email_key" ON "compradores"("email");

-- ---------------------------------------------------------------------------
-- pedidos: snapshot de comissão, repasse, taxa, desconto
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "pedidos_conta_id_status_idx";
DROP INDEX IF EXISTS "pedidos_conta_id_sincronizado_em_idx";
ALTER TABLE "pedidos" RENAME COLUMN "sincronizado_em" TO "sincronizado_desktop_em";
ALTER TABLE "pedidos"
  ADD COLUMN "desconto_centavos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taxa_cliente_centavos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "comissao_pct" DECIMAL(5,2),
  ADD COLUMN "taxa_provedor_centavos" INTEGER,
  ADD COLUMN "repasse_centavos" INTEGER;
UPDATE "pedidos" SET
  "comissao_pct" = CASE WHEN "subtotal_centavos" > 0
    THEN ROUND(("comissao_centavos"::numeric / "subtotal_centavos") * 100, 2) ELSE 0 END,
  "repasse_centavos" = "total_centavos" - "comissao_centavos";
ALTER TABLE "pedidos"
  ALTER COLUMN "comissao_pct" SET NOT NULL,
  ALTER COLUMN "repasse_centavos" SET NOT NULL;
CREATE INDEX "pedidos_conta_id_status_pago_em_idx" ON "pedidos"("conta_id", "status", "pago_em");
CREATE INDEX "pedidos_conta_id_sincronizado_desktop_em_idx" ON "pedidos"("conta_id", "sincronizado_desktop_em");

-- ---------------------------------------------------------------------------
-- pagamentos: id do provedor como chave única; split; qr como chave no bucket
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "pagamentos_provedor_provedor_ref_key";
ALTER TABLE "pagamentos" RENAME COLUMN "provedor_ref" TO "provedor_pagamento_id";
ALTER TABLE "pagamentos" RENAME COLUMN "confirmado_em" TO "aprovado_em";
ALTER TABLE "pagamentos" RENAME COLUMN "pix_qr_code" TO "pix_qr_key";
ALTER TABLE "pagamentos" ADD COLUMN "split_aplicado" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "pagamentos_provedor_pagamento_id_key" ON "pagamentos"("provedor_pagamento_id");

-- ---------------------------------------------------------------------------
-- downloads: comprador, limite de baixadas
-- ---------------------------------------------------------------------------

ALTER TABLE "downloads" RENAME COLUMN "contagem" TO "baixadas";
ALTER TABLE "downloads" RENAME COLUMN "baixado_em" TO "ultimo_download_em";
ALTER TABLE "downloads"
  ADD COLUMN "comprador_id" UUID,
  ADD COLUMN "limite_baixadas" INTEGER NOT NULL DEFAULT 5;
UPDATE "downloads" d SET "comprador_id" = p."comprador_id" FROM "pedidos" p WHERE p."id" = d."pedido_id";
ALTER TABLE "downloads" ALTER COLUMN "comprador_id" SET NOT NULL;
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_comprador_id_fkey"
  FOREIGN KEY ("comprador_id") REFERENCES "compradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "downloads_comprador_id_idx" ON "downloads"("comprador_id");
