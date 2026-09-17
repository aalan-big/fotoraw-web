-- Migration 5 — planos, assinaturas, licenças, faturas
-- Plano (catálogo) ≠ assinatura (contrato de cobrança) ≠ licença (direito de uso que o desktop checa).

CREATE TYPE "periodicidade" AS ENUM ('mensal', 'anual', 'nenhuma');
CREATE TYPE "origem_assinatura" AS ENUM ('site', 'admin');
CREATE TYPE "tipo_licenca" AS ENUM ('assinatura', 'cortesia', 'vitalicia', 'trial');
CREATE TYPE "status_licenca" AS ENUM ('ativa', 'suspensa', 'revogada', 'expirada');
CREATE TYPE "status_fatura" AS ENUM ('pendente', 'paga', 'vencida', 'cancelada', 'estornada');

-- ---------------------------------------------------------------------------
-- planos (catálogo) + seed inicial
-- ---------------------------------------------------------------------------

CREATE TABLE "planos" (
  "id" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "preco_centavos" INTEGER NOT NULL,
  "periodicidade" "periodicidade" NOT NULL,
  "comissao_evento_pct" DECIMAL(5,2) NOT NULL,
  "limite_galerias_ativas" INTEGER,
  "limite_fotos_por_galeria" INTEGER,
  "limite_armazenamento_mb" INTEGER,
  "limite_dispositivos" INTEGER,
  "permite_galeria_privada" BOOLEAN NOT NULL DEFAULT false,
  "permite_evento" BOOLEAN NOT NULL DEFAULT true,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "planos_codigo_key" ON "planos"("codigo");

INSERT INTO "planos" ("id", "codigo", "nome", "preco_centavos", "periodicidade", "comissao_evento_pct",
  "limite_galerias_ativas", "limite_fotos_por_galeria", "limite_armazenamento_mb", "limite_dispositivos",
  "permite_galeria_privada", "permite_evento", "ativo", "ordem", "atualizado_em")
VALUES
  (gen_random_uuid(), 'gratuito',   'Gratuito',   0,    'nenhuma', 10.00, 5,    2000, 20480,  1, false, true, true, 1, now()),
  (gen_random_uuid(), 'pro_mensal', 'PRO mensal', 4990, 'mensal',  10.00, NULL, NULL, 204800, 3, true,  true, true, 2, now()),
  (gen_random_uuid(), 'pro_anual',  'PRO anual',  49900,'anual',   10.00, NULL, NULL, 204800, 3, true,  true, true, 3, now());

-- ---------------------------------------------------------------------------
-- assinaturas reestruturada (era: plano enum, valor_mensal, provedor_ref, proxima_cobranca)
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "assinaturas_conta_id_idx";
DROP INDEX IF EXISTS "assinaturas_provedor_provedor_ref_key";

ALTER TABLE "assinaturas"
  ADD COLUMN "plano_id" UUID,
  ADD COLUMN "periodo_atual_inicio" TIMESTAMP(3),
  ADD COLUMN "periodo_atual_fim" TIMESTAMP(3),
  ADD COLUMN "cancela_no_fim_do_periodo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "provedor_assinatura_id" TEXT,
  ADD COLUMN "origem" "origem_assinatura" NOT NULL DEFAULT 'site',
  ADD COLUMN "observacao_admin" TEXT;

-- linhas existentes (se houver): plano PRO -> pro_mensal; período = início até próxima cobrança
UPDATE "assinaturas" a SET
  "plano_id" = (SELECT id FROM "planos" WHERE codigo = 'pro_mensal'),
  "periodo_atual_inicio" = a."inicio_em",
  "periodo_atual_fim" = COALESCE(a."proxima_cobranca", a."inicio_em" + interval '1 month'),
  "provedor_assinatura_id" = a."provedor_ref";

ALTER TABLE "assinaturas"
  ALTER COLUMN "plano_id" SET NOT NULL,
  ALTER COLUMN "periodo_atual_inicio" SET NOT NULL,
  ALTER COLUMN "periodo_atual_fim" SET NOT NULL,
  DROP COLUMN "plano",
  DROP COLUMN "valor_mensal",
  DROP COLUMN "provedor_ref",
  DROP COLUMN "proxima_cobranca";
DROP TYPE "plano";

ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_plano_id_fkey"
  FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "assinaturas_provedor_assinatura_id_key" ON "assinaturas"("provedor_assinatura_id");
CREATE INDEX "assinaturas_conta_id_status_idx" ON "assinaturas"("conta_id", "status");

-- ---------------------------------------------------------------------------
-- licencas
-- ---------------------------------------------------------------------------

CREATE TABLE "licencas" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "assinatura_id" UUID,
  "chave" TEXT NOT NULL,
  "tipo" "tipo_licenca" NOT NULL,
  "status" "status_licenca" NOT NULL DEFAULT 'ativa',
  "valida_ate" TIMESTAMP(3),
  "recursos" JSONB NOT NULL,
  "emitida_por_id" UUID,
  "motivo" TEXT,
  "emitida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizada_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "licencas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "licencas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "licencas_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "licencas_emitida_por_id_fkey" FOREIGN KEY ("emitida_por_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "licencas_chave_key" ON "licencas"("chave");
CREATE INDEX "licencas_conta_id_status_idx" ON "licencas"("conta_id", "status");
-- regra central: no máximo UMA licença ativa por conta (Prisma não expressa índice parcial)
CREATE UNIQUE INDEX "licencas_uma_ativa_por_conta" ON "licencas"("conta_id") WHERE "status" = 'ativa';

-- ---------------------------------------------------------------------------
-- faturas
-- ---------------------------------------------------------------------------

CREATE TABLE "faturas" (
  "id" UUID NOT NULL,
  "assinatura_id" UUID NOT NULL,
  "valor_centavos" INTEGER NOT NULL,
  "vencimento" DATE NOT NULL,
  "status" "status_fatura" NOT NULL DEFAULT 'pendente',
  "provedor_cobranca_id" TEXT,
  "paga_em" TIMESTAMP(3),
  "url_boleto_pix" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "faturas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "faturas_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "faturas_provedor_cobranca_id_key" ON "faturas"("provedor_cobranca_id");
CREATE INDEX "faturas_assinatura_id_status_idx" ON "faturas"("assinatura_id", "status");
