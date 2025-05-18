-- CreateEnum
CREATE TYPE "SessaoStatus" AS ENUM ('ATIVA', 'INATIVA', 'EXPIRADA', 'ERRO');

-- AlterTable
ALTER TABLE "tsession" ADD COLUMN     "status" "SessaoStatus" NOT NULL DEFAULT 'INATIVA',
ADD COLUMN     "ultimoUso" TIMESTAMP(3);
