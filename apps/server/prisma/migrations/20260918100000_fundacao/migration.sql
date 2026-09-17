-- Migration 4 — fundação
--  1. enums passam a ter valores minúsculos (iguais ao desktop), com mapeamento dos renomeados
--  2. dinheiro: Decimal(10,2) -> centavos int4
--  3. contas: status/papel/exclusão; api token -> tokens_api; dados de vitrine/split -> perfis
--  4. dispositivos
-- Tudo preservando as linhas existentes.

-- ---------------------------------------------------------------------------
-- 1. Enums minúsculos
-- ---------------------------------------------------------------------------

-- modalidade
CREATE TYPE "modalidade_new" AS ENUM ('evento', 'ensaio_interno', 'ensaio_externo');
ALTER TABLE "galerias" ALTER COLUMN "modalidade" DROP DEFAULT;
ALTER TABLE "galerias" ALTER COLUMN "modalidade" TYPE "modalidade_new"
  USING (lower("modalidade"::text)::"modalidade_new");
DROP TYPE "modalidade";
ALTER TYPE "modalidade_new" RENAME TO "modalidade";
ALTER TABLE "galerias" ALTER COLUMN "modalidade" SET DEFAULT 'evento';

-- visibilidade
CREATE TYPE "visibilidade_new" AS ENUM ('publica', 'privada', 'portfolio');
ALTER TABLE "galerias" ALTER COLUMN "visibilidade" DROP DEFAULT;
ALTER TABLE "galerias" ALTER COLUMN "visibilidade" TYPE "visibilidade_new"
  USING (lower("visibilidade"::text)::"visibilidade_new");
DROP TYPE "visibilidade";
ALTER TYPE "visibilidade_new" RENAME TO "visibilidade";
ALTER TABLE "galerias" ALTER COLUMN "visibilidade" SET DEFAULT 'privada';

-- categoria
CREATE TYPE "categoria_new" AS ENUM (
  'corrida_rua', 'trail', 'ciclismo', 'triatlo', 'natacao', 'esportivo',
  'formatura', 'casamento', 'festa', 'corporativo',
  'gestante', 'newborn', 'familia', 'infantil', 'quinze_anos', 'casal', 'pessoal', 'moda', 'produto',
  'outro'
);
ALTER TABLE "galerias" ALTER COLUMN "categoria" DROP DEFAULT;
ALTER TABLE "galerias" ALTER COLUMN "categoria" TYPE "categoria_new"
  USING (lower("categoria"::text)::"categoria_new");
DROP TYPE "categoria";
ALTER TYPE "categoria_new" RENAME TO "categoria";
ALTER TABLE "galerias" ALTER COLUMN "categoria" SET DEFAULT 'outro';

-- modo_venda
CREATE TYPE "modo_venda_new" AS ENUM ('avulso', 'pacote', 'entrega');
ALTER TABLE "galerias" ALTER COLUMN "modo_venda" TYPE "modo_venda_new"
  USING (lower("modo_venda"::text)::"modo_venda_new");
DROP TYPE "modo_venda";
ALTER TYPE "modo_venda_new" RENAME TO "modo_venda";

-- status_galeria: ARQUIVADA -> encerrada; + pausada
CREATE TYPE "status_galeria_new" AS ENUM ('rascunho', 'publicada', 'pausada', 'encerrada');
ALTER TABLE "galerias" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "galerias" ALTER COLUMN "status" TYPE "status_galeria_new"
  USING (CASE "status"::text WHEN 'ARQUIVADA' THEN 'encerrada' ELSE lower("status"::text) END::"status_galeria_new");
DROP TYPE "status_galeria";
ALTER TYPE "status_galeria_new" RENAME TO "status_galeria";
ALTER TABLE "galerias" ALTER COLUMN "status" SET DEFAULT 'rascunho';

-- status_pedido: REEMBOLSADO -> estornado
CREATE TYPE "status_pedido_new" AS ENUM ('aberto', 'aguardando_pagamento', 'pago', 'cancelado', 'expirado', 'estornado');
ALTER TABLE "pedidos" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "pedidos" ALTER COLUMN "status" TYPE "status_pedido_new"
  USING (CASE "status"::text WHEN 'REEMBOLSADO' THEN 'estornado' ELSE lower("status"::text) END::"status_pedido_new");
DROP TYPE "status_pedido";
ALTER TYPE "status_pedido_new" RENAME TO "status_pedido";
ALTER TABLE "pedidos" ALTER COLUMN "status" SET DEFAULT 'aberto';

-- status_pagamento: CONFIRMADO -> aprovado; + criado, expirado
CREATE TYPE "status_pagamento_new" AS ENUM ('criado', 'pendente', 'aprovado', 'recusado', 'estornado', 'expirado');
ALTER TABLE "pagamentos" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "pagamentos" ALTER COLUMN "status" TYPE "status_pagamento_new"
  USING (CASE "status"::text WHEN 'CONFIRMADO' THEN 'aprovado' ELSE lower("status"::text) END::"status_pagamento_new");
DROP TYPE "status_pagamento";
ALTER TYPE "status_pagamento_new" RENAME TO "status_pagamento";
ALTER TABLE "pagamentos" ALTER COLUMN "status" SET DEFAULT 'criado';

-- metodo_pagamento: + boleto
CREATE TYPE "metodo_pagamento_new" AS ENUM ('pix', 'cartao', 'boleto');
ALTER TABLE "pagamentos" ALTER COLUMN "metodo" TYPE "metodo_pagamento_new"
  USING (lower("metodo"::text)::"metodo_pagamento_new");
DROP TYPE "metodo_pagamento";
ALTER TYPE "metodo_pagamento_new" RENAME TO "metodo_pagamento";

-- provedor_pagamento -> provedor (MERCADO_PAGO -> mercadopago; + manual)
CREATE TYPE "provedor" AS ENUM ('mercadopago', 'stripe', 'asaas', 'manual');
ALTER TABLE "pagamentos" ALTER COLUMN "provedor" TYPE "provedor"
  USING (CASE "provedor"::text WHEN 'MERCADO_PAGO' THEN 'mercadopago' ELSE lower("provedor"::text) END::"provedor");
ALTER TABLE "webhooks_recebidos" ALTER COLUMN "provedor" TYPE "provedor"
  USING (CASE "provedor"::text WHEN 'MERCADO_PAGO' THEN 'mercadopago' ELSE lower("provedor"::text) END::"provedor");
ALTER TABLE "assinaturas" ALTER COLUMN "provedor" TYPE "provedor"
  USING (CASE "provedor"::text WHEN 'MERCADO_PAGO' THEN 'mercadopago' ELSE lower("provedor"::text) END::"provedor");
ALTER TABLE "contas" ALTER COLUMN "provedor_pagamento" TYPE "provedor"
  USING (CASE "provedor_pagamento"::text WHEN 'MERCADO_PAGO' THEN 'mercadopago' ELSE lower("provedor_pagamento"::text) END::"provedor");
DROP TYPE "provedor_pagamento";

-- status_assinatura: PENDENTE -> trial; + expirada
CREATE TYPE "status_assinatura_new" AS ENUM ('trial', 'ativa', 'inadimplente', 'cancelada', 'expirada');
ALTER TABLE "assinaturas" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "assinaturas" ALTER COLUMN "status" TYPE "status_assinatura_new"
  USING (CASE "status"::text WHEN 'PENDENTE' THEN 'trial' ELSE lower("status"::text) END::"status_assinatura_new");
DROP TYPE "status_assinatura";
ALTER TYPE "status_assinatura_new" RENAME TO "status_assinatura";
ALTER TABLE "assinaturas" ALTER COLUMN "status" SET DEFAULT 'trial';

-- novos
CREATE TYPE "status_conta" AS ENUM ('ativa', 'suspensa', 'bloqueada');
CREATE TYPE "papel_conta" AS ENUM ('fotografo', 'admin');
CREATE TYPE "status_foto" AS ENUM ('ativa', 'oculta');

-- ---------------------------------------------------------------------------
-- 2. Dinheiro -> centavos
-- ---------------------------------------------------------------------------

ALTER TABLE "galerias"
  ADD COLUMN "preco_foto_centavos" INTEGER,
  ADD COLUMN "preco_pacote_centavos" INTEGER;
UPDATE "galerias" SET "preco_foto_centavos" = ROUND("preco_foto" * 100)::int WHERE "preco_foto" IS NOT NULL;
-- preco_extra some: no modelo final o preço da extra é o próprio preco_foto (a foto pode sobrescrever)
UPDATE "galerias" SET "preco_foto_centavos" = ROUND("preco_extra" * 100)::int
  WHERE "preco_foto_centavos" IS NULL AND "preco_extra" IS NOT NULL;
ALTER TABLE "galerias" DROP COLUMN "preco_foto", DROP COLUMN "preco_extra";

ALTER TABLE "fotos" ADD COLUMN "preco_centavos" INTEGER;
UPDATE "fotos" SET "preco_centavos" = ROUND("preco" * 100)::int WHERE "preco" IS NOT NULL;
ALTER TABLE "fotos" DROP COLUMN "preco";

ALTER TABLE "pedidos"
  ADD COLUMN "subtotal_centavos" INTEGER,
  ADD COLUMN "comissao_centavos" INTEGER,
  ADD COLUMN "total_centavos" INTEGER;
UPDATE "pedidos" SET
  "subtotal_centavos" = ROUND("subtotal" * 100)::int,
  "comissao_centavos" = ROUND("comissao" * 100)::int,
  "total_centavos" = ROUND("total" * 100)::int;
ALTER TABLE "pedidos"
  ALTER COLUMN "subtotal_centavos" SET NOT NULL,
  ALTER COLUMN "comissao_centavos" SET NOT NULL,
  ALTER COLUMN "total_centavos" SET NOT NULL,
  DROP COLUMN "subtotal", DROP COLUMN "comissao", DROP COLUMN "total";

ALTER TABLE "itens_pedido" ADD COLUMN "preco_centavos" INTEGER;
UPDATE "itens_pedido" SET "preco_centavos" = ROUND("preco_unitario" * 100)::int;
ALTER TABLE "itens_pedido" ALTER COLUMN "preco_centavos" SET NOT NULL, DROP COLUMN "preco_unitario";

ALTER TABLE "pagamentos" ADD COLUMN "valor_centavos" INTEGER;
UPDATE "pagamentos" SET "valor_centavos" = ROUND("valor" * 100)::int;
ALTER TABLE "pagamentos" ALTER COLUMN "valor_centavos" SET NOT NULL, DROP COLUMN "valor";

-- ---------------------------------------------------------------------------
-- 3. contas -> perfis + tokens_api
-- ---------------------------------------------------------------------------

ALTER TABLE "contas"
  ADD COLUMN "status" "status_conta" NOT NULL DEFAULT 'ativa',
  ADD COLUMN "papel" "papel_conta" NOT NULL DEFAULT 'fotografo',
  ADD COLUMN "email_verificado_em" TIMESTAMP(3),
  ADD COLUMN "excluido_em" TIMESTAMP(3);
CREATE INDEX "contas_status_idx" ON "contas"("status");

CREATE TABLE "perfis" (
  "conta_id" UUID NOT NULL,
  "nome_fantasia" TEXT NOT NULL,
  "bio" TEXT,
  "logo_key" TEXT,
  "capa_key" TEXT,
  "whatsapp" TEXT,
  "instagram" TEXT,
  "site" TEXT,
  "cidade" TEXT,
  "uf" CHAR(2),
  "cnpj_cpf" TEXT,
  "chave_pix" TEXT,
  "taxas_para_cliente" BOOLEAN NOT NULL DEFAULT false,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "perfis_pkey" PRIMARY KEY ("conta_id"),
  CONSTRAINT "perfis_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- toda conta existente ganha perfil com o próprio nome
INSERT INTO "perfis" ("conta_id", "nome_fantasia", "atualizado_em")
SELECT "id", "nome", now() FROM "contas";

-- conta do fotógrafo no provedor (OAuth Mercado Pago); tokens cifrados pela app
CREATE TABLE "conexoes_pagamento" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "provedor" "provedor" NOT NULL,
  "provedor_usuario_id" TEXT NOT NULL,
  "access_token_cifrado" TEXT NOT NULL,
  "refresh_token_cifrado" TEXT,
  "token_expira_em" TIMESTAMP(3),
  "rotulo" TEXT,
  "conectado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revogado_em" TIMESTAMP(3),
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conexoes_pagamento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conexoes_pagamento_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conexoes_pagamento_conta_id_provedor_key" ON "conexoes_pagamento"("conta_id", "provedor");

CREATE TABLE "tokens_api" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ultimo_uso_em" TIMESTAMP(3),
  "expira_em" TIMESTAMP(3),
  "revogado_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tokens_api_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tokens_api_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tokens_api_token_hash_key" ON "tokens_api"("token_hash");
CREATE INDEX "tokens_api_conta_id_idx" ON "tokens_api"("conta_id");
-- token que estava na conta vira uma linha aqui
INSERT INTO "tokens_api" ("id", "conta_id", "token_hash", "nome", "criado_em")
SELECT gen_random_uuid(), "id", "api_token_hash", 'Desktop', COALESCE("api_token_criado_em", now())
FROM "contas" WHERE "api_token_hash" IS NOT NULL;

ALTER TABLE "contas"
  DROP COLUMN "api_token_hash",
  DROP COLUMN "api_token_criado_em",
  DROP COLUMN "plano",
  DROP COLUMN "status_plano",
  DROP COLUMN "provedor_pagamento",
  DROP COLUMN "provedor_pagamento_ref";
DROP TYPE "status_plano";

-- ---------------------------------------------------------------------------
-- 4. dispositivos
-- ---------------------------------------------------------------------------

CREATE TABLE "dispositivos" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "versao_app" TEXT,
  "ultimo_visto_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispositivos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dispositivos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "dispositivos_conta_id_fingerprint_key" ON "dispositivos"("conta_id", "fingerprint");
