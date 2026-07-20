-- CreateTable
CREATE TABLE "naf_nomina_revision_checklist" (
    "id" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "codPla" TEXT NOT NULL,
    "fDesde" DATE NOT NULL,
    "fHasta" DATE NOT NULL,
    "revisada" BOOLEAN NOT NULL DEFAULT false,
    "generada" BOOLEAN NOT NULL DEFAULT false,
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naf_nomina_revision_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "naf_nomina_revision_checklist_fDesde_fHasta_idx" ON "naf_nomina_revision_checklist"("fDesde", "fHasta");

-- CreateIndex
CREATE INDEX "naf_nomina_revision_checklist_noCia_codPla_idx" ON "naf_nomina_revision_checklist"("noCia", "codPla");

-- CreateIndex
CREATE UNIQUE INDEX "naf_nomina_revision_checklist_noCia_codPla_fDesde_fHasta_key" ON "naf_nomina_revision_checklist"("noCia", "codPla", "fDesde", "fHasta");
