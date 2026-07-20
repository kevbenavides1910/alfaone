-- AlterTable
ALTER TABLE "naf_nomina_revision_checklist" ADD COLUMN "aprobadaAt" TIMESTAMP(3),
ADD COLUMN "preparadaAt" TIMESTAMP(3),
ADD COLUMN "pagadaAt" TIMESTAMP(3),
ADD COLUMN "aprobadaBy" TEXT,
ADD COLUMN "preparadaBy" TEXT,
ADD COLUMN "pagadaBy" TEXT,
ADD COLUMN "indCkActNaf" TEXT;

-- CreateTable
CREATE TABLE "naf_nomina_pago_lotes" (
    "id" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "codPla" TEXT NOT NULL,
    "fDesde" DATE NOT NULL,
    "fHasta" DATE NOT NULL,
    "fechaPago" DATE NOT NULL,
    "secuencias" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'preparado',
    "totalCheque" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDav" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalBn" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalOtro" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalGeneral" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "empleados" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naf_nomina_pago_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naf_nomina_pago_lineas" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "noEmple" TEXT NOT NULL,
    "nombre" TEXT,
    "cedula" TEXT,
    "formaPago" TEXT,
    "idCta" TEXT,
    "canal" TEXT NOT NULL,
    "bancoDestino" TEXT,
    "numCuenta" TEXT,
    "bancoOrigen" TEXT,
    "ctaOrigen" TEXT,
    "noSecuencia" TEXT NOT NULL,
    "liquido" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "naf_nomina_pago_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "naf_nomina_pago_lotes_noCia_codPla_fDesde_fHasta_idx" ON "naf_nomina_pago_lotes"("noCia", "codPla", "fDesde", "fHasta");

-- CreateIndex
CREATE INDEX "naf_nomina_pago_lineas_loteId_idx" ON "naf_nomina_pago_lineas"("loteId");

-- CreateIndex
CREATE INDEX "naf_nomina_pago_lineas_noEmple_idx" ON "naf_nomina_pago_lineas"("noEmple");

-- AddForeignKey
ALTER TABLE "naf_nomina_pago_lineas" ADD CONSTRAINT "naf_nomina_pago_lineas_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "naf_nomina_pago_lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
