-- CreateTable
CREATE TABLE "tempresa" (
    "id" TEXT NOT NULL,
    "cpfcnpj" TEXT NOT NULL,
    "nome" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tempresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tsession" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sessionName" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "sessionPath" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tsession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tempresa_cpfcnpj_key" ON "tempresa"("cpfcnpj");

-- CreateIndex
CREATE UNIQUE INDEX "tsession_empresaId_numero_key" ON "tsession"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "tsession_empresaId_sessionName_key" ON "tsession"("empresaId", "sessionName");

-- AddForeignKey
ALTER TABLE "tsession" ADD CONSTRAINT "tsession_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "tempresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
