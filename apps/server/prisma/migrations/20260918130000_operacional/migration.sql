-- Migration 7 — operacional: repasses, sync_lotes, auditoria, configuracoes_plataforma

CREATE TYPE "status_repasse" AS ENUM ('aberto', 'solicitado', 'pago', 'falhou');
CREATE TYPE "metodo_repasse" AS ENUM ('split_automatico', 'pix_manual');
CREATE TYPE "tipo_sync" AS ENUM ('publicar', 'atualizar_fotos', 'despublicar', 'puxar_pedidos');
CREATE TYPE "status_sync" AS ENUM ('recebido', 'processando', 'concluido', 'erro');

-- ---------------------------------------------------------------------------
-- repasses — saldo do fotógrafo é view, não coluna
-- ---------------------------------------------------------------------------

CREATE TABLE "repasses" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "periodo_inicio" DATE NOT NULL,
  "periodo_fim" DATE NOT NULL,
  "valor_centavos" INTEGER NOT NULL,
  "status" "status_repasse" NOT NULL DEFAULT 'aberto',
  "metodo" "metodo_repasse" NOT NULL,
  "provedor_transferencia_id" TEXT,
  "pago_em" TIMESTAMP(3),
  "comprovante_key" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repasses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repasses_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "repasses_conta_id_status_idx" ON "repasses"("conta_id", "status");

-- saldo a receber por conta: vendas pagas − repasses já pagos
CREATE VIEW "saldos_fotografo" AS
SELECT
  c."id" AS "conta_id",
  COALESCE((SELECT SUM(p."repasse_centavos") FROM "pedidos" p WHERE p."conta_id" = c."id" AND p."status" = 'pago'), 0)
    - COALESCE((SELECT SUM(r."valor_centavos") FROM "repasses" r WHERE r."conta_id" = c."id" AND r."status" = 'pago'), 0)
    AS "saldo_centavos"
FROM "contas" c;

-- ---------------------------------------------------------------------------
-- sync_lotes — cada publicação/atualização vinda do desktop
-- ---------------------------------------------------------------------------

CREATE TABLE "sync_lotes" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "token_api_id" UUID NOT NULL,
  "galeria_id" UUID,
  "tipo" "tipo_sync" NOT NULL,
  "chave_idempotencia" TEXT NOT NULL,
  "status" "status_sync" NOT NULL DEFAULT 'recebido',
  "total_itens" INTEGER NOT NULL DEFAULT 0,
  "itens_ok" INTEGER NOT NULL DEFAULT 0,
  "itens_erro" INTEGER NOT NULL DEFAULT 0,
  "erro" TEXT,
  "iniciado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluido_em" TIMESTAMP(3),
  CONSTRAINT "sync_lotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sync_lotes_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sync_lotes_token_api_id_fkey" FOREIGN KEY ("token_api_id") REFERENCES "tokens_api"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sync_lotes_galeria_id_fkey" FOREIGN KEY ("galeria_id") REFERENCES "galerias"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sync_lotes_chave_idempotencia_key" ON "sync_lotes"("chave_idempotencia");
CREATE INDEX "sync_lotes_conta_id_status_idx" ON "sync_lotes"("conta_id", "status");

-- ---------------------------------------------------------------------------
-- auditoria — o que o admin fez
-- ---------------------------------------------------------------------------

CREATE TABLE "auditoria" (
  "id" UUID NOT NULL,
  "ator_conta_id" UUID,
  "acao" TEXT NOT NULL,
  "alvo_tipo" TEXT NOT NULL,
  "alvo_id" TEXT NOT NULL,
  "antes" JSONB,
  "depois" JSONB,
  "ip" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auditoria_ator_conta_id_fkey" FOREIGN KEY ("ator_conta_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "auditoria_alvo_tipo_alvo_id_idx" ON "auditoria"("alvo_tipo", "alvo_id");
CREATE INDEX "auditoria_ator_conta_id_criado_em_idx" ON "auditoria"("ator_conta_id", "criado_em");

-- ---------------------------------------------------------------------------
-- configuracoes_plataforma + valores padrão
-- ---------------------------------------------------------------------------

CREATE TABLE "configuracoes_plataforma" (
  "chave" TEXT NOT NULL,
  "valor" JSONB NOT NULL,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "configuracoes_plataforma_pkey" PRIMARY KEY ("chave")
);

INSERT INTO "configuracoes_plataforma" ("chave", "valor", "atualizado_em") VALUES
  ('comissao_padrao_pct',        '10',                              now()),
  ('download_dias_validade',     '30',                              now()),
  ('download_limite_baixadas',   '5',                               now()),
  ('pix_reserva_minutos',        '30',                              now()),
  ('trial_dias',                 '14',                              now()),
  ('email_contato',              '"contato@fotoraw.com.br"',        now()),
  ('email_suporte',              '"suporte@fotoraw.com.br"',        now());
