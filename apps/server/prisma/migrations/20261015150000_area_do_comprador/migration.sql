-- área "Minhas fotos": entrar sem senha (Google ou código por e-mail)
ALTER TABLE "compradores" ALTER COLUMN "aceitou_termos_em" DROP NOT NULL;
ALTER TABLE "compradores" ADD COLUMN "google_id" TEXT;
ALTER TABLE "compradores" ADD COLUMN "ultimo_acesso_em" TIMESTAMP(3);
CREATE UNIQUE INDEX "compradores_google_id_key" ON "compradores"("google_id");

CREATE TABLE "codigos_comprador" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "codigos_comprador_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "codigos_comprador_email_criado_em_idx" ON "codigos_comprador"("email", "criado_em");

-- download liberado enquanto a galeria existir (decisão de 15/10/2026): vale pros já vendidos
UPDATE "downloads" SET "expira_em" = '2100-01-01', "limite_baixadas" = 1000;
