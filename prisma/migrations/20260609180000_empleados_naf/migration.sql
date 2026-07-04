-- CreateTable
CREATE TABLE "naf_employee_sync_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowsFetched" INTEGER NOT NULL DEFAULT 0,
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "triggeredBy" TEXT,

    CONSTRAINT "naf_employee_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naf_employees" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "noEmple" TEXT NOT NULL,
    "nombre" TEXT,
    "nombrePila" TEXT,
    "apePat" TEXT,
    "apeMat" TEXT,
    "estado" TEXT,
    "cedula" TEXT,
    "telefono" TEXT,
    "correoElectronico" TEXT,
    "area" TEXT,
    "depto" TEXT,
    "puesto" TEXT,
    "sexo" TEXT,
    "formaPago" TEXT,
    "numCuenta" TEXT,
    "tipoEmp" TEXT,
    "contrato" TEXT,
    "categoria" TEXT,
    "indOficial" TEXT,
    "fIngreso" TIMESTAMP(3),
    "fEgreso" TIMESTAMP(3),
    "salBas" DECIMAL(14,2),
    "payload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naf_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "naf_employees_sourceKey_key" ON "naf_employees"("sourceKey");

-- CreateIndex
CREATE INDEX "naf_employee_sync_runs_startedAt_idx" ON "naf_employee_sync_runs"("startedAt");

-- CreateIndex
CREATE INDEX "naf_employees_nombre_idx" ON "naf_employees"("nombre");

-- CreateIndex
CREATE INDEX "naf_employees_cedula_idx" ON "naf_employees"("cedula");

-- CreateIndex
CREATE INDEX "naf_employees_estado_idx" ON "naf_employees"("estado");

-- CreateIndex
CREATE INDEX "naf_employees_noCia_idx" ON "naf_employees"("noCia");

-- CreateIndex
CREATE INDEX "naf_employees_syncedAt_idx" ON "naf_employees"("syncedAt");
