-- CreateTable
CREATE TABLE "tsessionlog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tsessionlog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tsessionlog_sessionId_idx" ON "tsessionlog"("sessionId");

-- AddForeignKey
ALTER TABLE "tsessionlog" ADD CONSTRAINT "tsessionlog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tsession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
