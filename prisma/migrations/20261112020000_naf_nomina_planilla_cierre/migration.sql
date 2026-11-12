-- CreateTable
CREATE TABLE "naf_nomina_planilla_cierres" (
    "id" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "codPla" TEXT NOT NULL,
    "fDesde" DATE NOT NULL,
    "fHasta" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "nominaNombre" TEXT,
    "empleados" INTEGER NOT NULL DEFAULT 0,
    "ingresos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deducciones" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "liquido" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozenBy" TEXT,

    CONSTRAINT "naf_nomina_planilla_cierres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naf_nomina_planilla_cierre_lineas" (
    "id" TEXT NOT NULL,
    "cierreId" TEXT NOT NULL,
    "noEmple" TEXT NOT NULL,
    "nombre" TEXT,
    "cedula" TEXT,
    "formaPago" TEXT,
    "banco" TEXT,
    "idCta" TEXT,
    "numCuenta" TEXT,
    "canal" TEXT NOT NULL,
    "ingresos" DECIMAL(18,2) NOT NULL,
    "deducciones" DECIMAL(18,2) NOT NULL,
    "liquido" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "naf_nomina_planilla_cierre_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "naf_nomina_planilla_cierres_fDesde_fHasta_idx" ON "naf_nomina_planilla_cierres"("fDesde", "fHasta");

-- CreateIndex
CREATE UNIQUE INDEX "naf_nomina_planilla_cierres_noCia_codPla_fDesde_fHasta_key" ON "naf_nomina_planilla_cierres"("noCia", "codPla", "fDesde", "fHasta");

-- CreateIndex
CREATE UNIQUE INDEX "naf_nomina_planilla_cierre_lineas_cierreId_noEmple_key" ON "naf_nomina_planilla_cierre_lineas"("cierreId", "noEmple");

-- AddForeignKey
ALTER TABLE "naf_nomina_planilla_cierre_lineas" ADD CONSTRAINT "naf_nomina_planilla_cierre_lineas_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "naf_nomina_planilla_cierres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

