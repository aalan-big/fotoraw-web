-- CreateEnum
CREATE TYPE "categoria_evento" AS ENUM ('CORRIDA_RUA', 'TRAIL', 'CICLISMO', 'TRIATLO', 'NATACAO', 'ESPORTIVO', 'FORMATURA', 'CASAMENTO', 'FESTA', 'CORPORATIVO', 'OUTRO');

-- AlterTable
ALTER TABLE "galerias" ADD COLUMN     "categoria" "categoria_evento" NOT NULL DEFAULT 'OUTRO',
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "data_evento" DATE,
ADD COLUMN     "uf" CHAR(2);

