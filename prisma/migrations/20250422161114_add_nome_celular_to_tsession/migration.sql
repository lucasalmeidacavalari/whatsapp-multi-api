/*
  Warnings:

  - You are about to drop the column `nome` on the `tempresa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tempresa" DROP COLUMN "nome";

-- AlterTable
ALTER TABLE "tsession" ADD COLUMN     "nomeCelular" TEXT;
