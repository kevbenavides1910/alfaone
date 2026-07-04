-- Campos del reporte "Empleados y Cuentas Bancarias" (Oracle APEX)
ALTER TABLE "naf_employees" ADD COLUMN "tipoCuenta" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "banco" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "ubicacionCode" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "ubicacionNombre" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "asegu" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "noRol" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "tituloCode" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "tituloNombre" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "nominaCode" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "nominaNombre" TEXT;

CREATE INDEX "naf_employees_contrato_idx" ON "naf_employees"("contrato");
CREATE INDEX "naf_employees_ubicacionCode_idx" ON "naf_employees"("ubicacionCode");
