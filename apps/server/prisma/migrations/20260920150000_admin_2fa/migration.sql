-- Migration 12 — 2FA TOTP na conta (admin). Segredo cifrado no server; códigos de
-- recuperação guardados como hash e consumidos no uso.
ALTER TABLE "contas"
  ADD COLUMN "totp_segredo"        TEXT,
  ADD COLUMN "totp_ativado_em"     TIMESTAMP(3),
  ADD COLUMN "codigos_recuperacao" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
