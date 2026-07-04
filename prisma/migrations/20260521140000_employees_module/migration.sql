-- CreateTable
CREATE TABLE "employee_import_batches" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "employeesUpserted" INTEGER NOT NULL DEFAULT 0,
    "placementsUpserted" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "codigoEmpleado" TEXT NOT NULL,
    "codigoEmpleadoRaw" TEXT,
    "nombre" TEXT,
    "cedula" TEXT,
    "aseguradora" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "direccion" TEXT,
    "sexo" TEXT,
    "oficial" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT,
    "formaPago" TEXT,
    "tipoCuenta" TEXT,
    "numeroCuenta" TEXT,
    "tituloCode" TEXT,
    "tituloNombre" TEXT,
    "clase" TEXT,
    "nominaCode" TEXT,
    "nominaNombre" TEXT,
    "fechaIngreso" TIMESTAMP(3),
    "centroCosto" TEXT,
    "categoria" TEXT,
    "zona" TEXT,
    "companySapCode" TEXT,
    "lastImportBatchId" TEXT,
    "lastSourceFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_placements" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companySapCode" TEXT,
    "contrato" TEXT,
    "contratoNormalizado" TEXT,
    "contractId" TEXT,
    "ubicacionCode" TEXT,
    "ubicacionNombre" TEXT,
    "puestoNombre" TEXT,
    "noRol" TEXT,
    "zona" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_import_batches_checksum_key" ON "employee_import_batches"("checksum");

-- CreateIndex
CREATE INDEX "employee_import_batches_createdAt_idx" ON "employee_import_batches"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "employees_codigoEmpleado_key" ON "employees"("codigoEmpleado");

-- CreateIndex
CREATE INDEX "employees_nombre_idx" ON "employees"("nombre");

-- CreateIndex
CREATE INDEX "employees_cedula_idx" ON "employees"("cedula");

-- CreateIndex
CREATE INDEX "employees_zona_idx" ON "employees"("zona");

-- CreateIndex
CREATE INDEX "employees_estado_idx" ON "employees"("estado");

-- CreateIndex
CREATE INDEX "employees_companySapCode_idx" ON "employees"("companySapCode");

-- CreateIndex
CREATE UNIQUE INDEX "employee_placements_employeeId_contratoNormalizado_ubicacionCode_noRol_key" ON "employee_placements"("employeeId", "contratoNormalizado", "ubicacionCode", "noRol");

-- CreateIndex
CREATE INDEX "employee_placements_employeeId_idx" ON "employee_placements"("employeeId");

-- CreateIndex
CREATE INDEX "employee_placements_contractId_idx" ON "employee_placements"("contractId");

-- CreateIndex
CREATE INDEX "employee_placements_contratoNormalizado_idx" ON "employee_placements"("contratoNormalizado");

-- CreateIndex
CREATE INDEX "employee_placements_ubicacionCode_idx" ON "employee_placements"("ubicacionCode");

-- AddForeignKey
ALTER TABLE "employee_import_batches" ADD CONSTRAINT "employee_import_batches_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_lastImportBatchId_fkey" FOREIGN KEY ("lastImportBatchId") REFERENCES "employee_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_placements" ADD CONSTRAINT "employee_placements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_placements" ADD CONSTRAINT "employee_placements_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_placements" ADD CONSTRAINT "employee_placements_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "employee_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
