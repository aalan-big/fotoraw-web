-- Migration 15 — Web Push pro celular do admin (pagamento recebido, cobrança recusada…).

CREATE TABLE "inscricoes_push" (
    "id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricoes_push_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inscricoes_push_endpoint_key" ON "inscricoes_push"("endpoint");
CREATE INDEX "inscricoes_push_conta_id_idx" ON "inscricoes_push"("conta_id");

ALTER TABLE "inscricoes_push" ADD CONSTRAINT "inscricoes_push_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
