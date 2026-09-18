-- Migration 9 — tokens_api.dispositivo_id: qual máquina usa o token
-- Revogar um dispositivo na web revoga o token dele; novo login na mesma máquina troca o token.

ALTER TABLE "tokens_api" ADD COLUMN "dispositivo_id" UUID;
ALTER TABLE "tokens_api"
  ADD CONSTRAINT "tokens_api_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id")
  REFERENCES "dispositivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "tokens_api_dispositivo_id_idx" ON "tokens_api"("dispositivo_id");
