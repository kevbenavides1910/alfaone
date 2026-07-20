-- CreateTable
CREATE TABLE "naf_nomina_manual_allocations" (
    "id" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "noEmple" TEXT NOT NULL,
    "fDesde" DATE NOT NULL,
    "fHasta" DATE NOT NULL,
    "codPla" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "devengado" DECIMAL(18,2) NOT NULL,
    "deducciones" DECIMAL(18,2) NOT NULL,
    "neto" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naf_nomina_manual_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "naf_nomina_manual_allocations_fDesde_fHasta_idx" ON "naf_nomina_manual_allocations"("fDesde", "fHasta");

-- CreateIndex
CREATE INDEX "naf_nomina_manual_allocations_noCia_noEmple_idx" ON "naf_nomina_manual_allocations"("noCia", "noEmple");

-- CreateIndex
CREATE INDEX "naf_nomina_manual_allocations_contractId_idx" ON "naf_nomina_manual_allocations"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "naf_nomina_manual_allocations_noCia_noEmple_fDesde_fHasta_cod_key" ON "naf_nomina_manual_allocations"("noCia", "noEmple", "fDesde", "fHasta", "codPla", "contractId");

-- AddForeignKey
ALTER TABLE "naf_nomina_manual_allocations" ADD CONSTRAINT "naf_nomina_manual_allocations_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
