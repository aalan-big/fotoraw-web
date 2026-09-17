-- Separa "o que é" (modalidade) de "quem vê" (visibilidade); tipo_galeria sai.
-- Categoria ganha os tipos de ensaio.

-- CreateEnum
CREATE TYPE "modalidade" AS ENUM ('EVENTO', 'ENSAIO_INTERNO', 'ENSAIO_EXTERNO');

-- CreateEnum
CREATE TYPE "visibilidade" AS ENUM ('PUBLICA', 'PRIVADA', 'PORTFOLIO');

-- CreateEnum (substitui categoria_evento, com os valores de ensaio)
CREATE TYPE "categoria" AS ENUM (
  'CORRIDA_RUA', 'TRAIL', 'CICLISMO', 'TRIATLO', 'NATACAO', 'ESPORTIVO',
  'FORMATURA', 'CASAMENTO', 'FESTA', 'CORPORATIVO',
  'GESTANTE', 'NEWBORN', 'FAMILIA', 'INFANTIL', 'QUINZE_ANOS', 'CASAL', 'PESSOAL', 'MODA', 'PRODUTO',
  'OUTRO'
);

-- AlterTable: novas colunas
ALTER TABLE "galerias"
  ADD COLUMN "modalidade"   "modalidade"   NOT NULL DEFAULT 'EVENTO',
  ADD COLUMN "visibilidade" "visibilidade" NOT NULL DEFAULT 'PRIVADA';

-- Migra tipo -> visibilidade (EVENTO era público, PRIVADO era privado)
UPDATE "galerias" SET "visibilidade" = CASE "tipo"::text
  WHEN 'EVENTO'  THEN 'PUBLICA'::"visibilidade"
  WHEN 'PRIVADO' THEN 'PRIVADA'::"visibilidade"
END;

-- Troca o tipo da coluna categoria (mesmos nomes de valor)
ALTER TABLE "galerias"
  ALTER COLUMN "categoria" DROP DEFAULT,
  ALTER COLUMN "categoria" TYPE "categoria" USING ("categoria"::text::"categoria"),
  ALTER COLUMN "categoria" SET DEFAULT 'OUTRO';

-- Remove o antigo
DROP INDEX IF EXISTS "galerias_status_publicada_em_idx";
ALTER TABLE "galerias" DROP COLUMN "tipo";
DROP TYPE "tipo_galeria";
DROP TYPE "categoria_evento";

-- CreateIndex
CREATE INDEX "galerias_status_visibilidade_publicada_em_idx" ON "galerias"("status", "visibilidade", "publicada_em");
