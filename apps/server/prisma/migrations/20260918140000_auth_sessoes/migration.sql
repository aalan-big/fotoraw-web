-- Migration 8 — auth: sessoes_web (refresh tokens da web) e tokens_verificacao (e-mail / senha)
-- Fluxo em docs/fluxos/ambiente-fotografo.md §1. O desktop NÃO usa estas tabelas (usa tokens_api).

CREATE TYPE "tipo_token_verificacao" AS ENUM ('verificar_email', 'redefinir_senha', 'trocar_email');

-- ---------------------------------------------------------------------------
-- sessoes_web — um registro por refresh token emitido (web do fotógrafo e admin)
-- Rotação: cada /auth/refresh marca a sessão atual como usada e cria outra na mesma família.
-- Reuso de uma sessão já usada = token roubado → revoga a família inteira.
-- ---------------------------------------------------------------------------

CREATE TABLE "sessoes_web" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "familia" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_agent" TEXT,
  "ip" TEXT,
  "expira_em" TIMESTAMP(3) NOT NULL,
  "usada_em" TIMESTAMP(3),
  "revogada_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessoes_web_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessoes_web_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sessoes_web_token_hash_key" ON "sessoes_web"("token_hash");
CREATE INDEX "sessoes_web_conta_id_idx" ON "sessoes_web"("conta_id");
CREATE INDEX "sessoes_web_familia_idx" ON "sessoes_web"("familia");

-- ---------------------------------------------------------------------------
-- tokens_verificacao — links de uso único enviados por e-mail
-- verificar_email: após o cadastro · redefinir_senha: "esqueci a senha" (30 min)
-- trocar_email: PATCH /me com e-mail novo — `dados` guarda { "email": "novo@..." } até confirmar
-- ---------------------------------------------------------------------------

CREATE TABLE "tokens_verificacao" (
  "id" UUID NOT NULL,
  "conta_id" UUID NOT NULL,
  "tipo" "tipo_token_verificacao" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "dados" JSONB,
  "expira_em" TIMESTAMP(3) NOT NULL,
  "usado_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tokens_verificacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tokens_verificacao_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tokens_verificacao_token_hash_key" ON "tokens_verificacao"("token_hash");
CREATE INDEX "tokens_verificacao_conta_id_tipo_idx" ON "tokens_verificacao"("conta_id", "tipo");
