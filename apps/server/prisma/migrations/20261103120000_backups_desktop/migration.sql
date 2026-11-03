-- Etapa 2: backup do banco do desktop (todos os planos), arquivo em fotoraw-originais/backups/<conta>/
-- CreateEnum
CREATE TYPE "status_backup" AS ENUM ('enviando', 'concluido');

-- CreateTable
CREATE TABLE "backups_desktop" (
    "id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "dispositivo_id" UUID,
    "chave" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "versao_app" TEXT,
    "resumo" JSONB,
    "status" "status_backup" NOT NULL DEFAULT 'enviando',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMP(3),

    CONSTRAINT "backups_desktop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backups_desktop_chave_key" ON "backups_desktop"("chave");

-- CreateIndex
CREATE INDEX "backups_desktop_conta_id_status_criado_em_idx" ON "backups_desktop"("conta_id", "status", "criado_em");

-- AddForeignKey
ALTER TABLE "backups_desktop" ADD CONSTRAINT "backups_desktop_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups_desktop" ADD CONSTRAINT "backups_desktop_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

