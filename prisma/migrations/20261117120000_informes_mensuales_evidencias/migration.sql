-- CreateTable
CREATE TABLE "informes_mensuales_evidencias" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informes_mensuales_evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "informes_mensuales_evidencias_incidentId_idx" ON "informes_mensuales_evidencias"("incidentId");

-- AddForeignKey
ALTER TABLE "informes_mensuales_evidencias" ADD CONSTRAINT "informes_mensuales_evidencias_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "informes_mensuales_incidencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
