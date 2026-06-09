-- Maestro disciplinario (CSV RRHH); opcional si ya se usa tabla employees
CREATE TABLE IF NOT EXISTS "disciplinary_employee_master" (
    "id" TEXT NOT NULL,
    "codigoEmpleado" TEXT NOT NULL,
    "codigoEmpleadoRaw" TEXT,
    "nombre" TEXT,
    "cedula" TEXT,
    "email" TEXT,
    "zona" TEXT,
    "telefono" TEXT,
    "cuentaBancaria" TEXT,
    "extra" JSONB,
    "lastSourceFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disciplinary_employee_master_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "disciplinary_employee_master_codigoEmpleado_key"
    ON "disciplinary_employee_master"("codigoEmpleado");

CREATE INDEX IF NOT EXISTS "disciplinary_employee_master_updatedAt_idx"
    ON "disciplinary_employee_master"("updatedAt");
