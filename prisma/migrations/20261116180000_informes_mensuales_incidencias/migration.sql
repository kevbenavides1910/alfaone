-- CreateTable
CREATE TABLE "informes_mensuales_incidencias" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informes_mensuales_incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "informes_mensuales_incidencias_source_idx" ON "informes_mensuales_incidencias"("source");
