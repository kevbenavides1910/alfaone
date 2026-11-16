-- CreateTable
CREATE TABLE "informes_mensuales" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informes_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "informes_mensuales_period_idx" ON "informes_mensuales"("period");
