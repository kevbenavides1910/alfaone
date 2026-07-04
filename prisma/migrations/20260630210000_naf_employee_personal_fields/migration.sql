-- Campos adicionales del reporte APEX (zona, nacimiento, clasificación)
ALTER TABLE "naf_employees" ADD COLUMN "clase" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "fNacimi" TIMESTAMP(3);
ALTER TABLE "naf_employees" ADD COLUMN "direccion" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "zonaCode" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "zona" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "eCivil" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "jornada" TEXT;
ALTER TABLE "naf_employees" ADD COLUMN "nacion" TEXT;

CREATE INDEX "naf_employees_zona_idx" ON "naf_employees"("zona");
CREATE INDEX "naf_employees_fNacimi_idx" ON "naf_employees"("fNacimi");
