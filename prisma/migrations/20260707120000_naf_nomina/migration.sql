-- CreateTable
CREATE TABLE "naf_nomina_sync_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowsFetched" INTEGER NOT NULL DEFAULT 0,
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "desdeAno" INTEGER,
    "errorMessage" TEXT,
    "triggeredBy" TEXT,

    CONSTRAINT "naf_nomina_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naf_nomina_summary" (
    "id" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "noEmple" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "periodo" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "codPla" TEXT NOT NULL,
    "nominaNombre" TEXT,
    "devengado" DECIMAL(18,2) NOT NULL,
    "deducciones" DECIMAL(18,2) NOT NULL,
    "neto" DECIMAL(18,2) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naf_nomina_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naf_nomina_period_meta" (
    "id" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "codPla" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "periodo" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fDesde" TIMESTAMP(3),
    "fHasta" TIMESTAMP(3),
    "fCalculo" TIMESTAMP(3),
    "tipoEmp" TEXT,
    "descri" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naf_nomina_period_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "naf_nomina_sync_runs_startedAt_idx" ON "naf_nomina_sync_runs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "naf_nomina_summary_noCia_ano_periodo_noEmple_codPla_key" ON "naf_nomina_summary"("noCia", "ano", "periodo", "noEmple", "codPla");

-- CreateIndex
CREATE INDEX "naf_nomina_summary_noCia_ano_periodo_idx" ON "naf_nomina_summary"("noCia", "ano", "periodo");

-- CreateIndex
CREATE INDEX "naf_nomina_summary_ano_periodo_idx" ON "naf_nomina_summary"("ano", "periodo");

-- CreateIndex
CREATE INDEX "naf_nomina_summary_noEmple_idx" ON "naf_nomina_summary"("noEmple");

-- CreateIndex
CREATE UNIQUE INDEX "naf_nomina_period_meta_noCia_codPla_ano_periodo_key" ON "naf_nomina_period_meta"("noCia", "codPla", "ano", "periodo");

-- CreateIndex
CREATE INDEX "naf_nomina_period_meta_ano_periodo_idx" ON "naf_nomina_period_meta"("ano", "periodo");
