-- Código planilla RRHH en catálogo de empresas y vínculo con empleados.

ALTER TABLE "companies" ADD COLUMN "sapCode" TEXT;

CREATE UNIQUE INDEX "companies_sapCode_key" ON "companies"("sapCode");

INSERT INTO "companies" ("code", "name", "sapCode", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES ('DESARROLLOS', 'Desarrollos Constructivos', '08', true, 12, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "sapCode" = EXCLUDED."sapCode",
  "name" = EXCLUDED."name",
  "updatedAt" = NOW();

UPDATE "companies" SET "sapCode" = '01', "updatedAt" = NOW() WHERE "code" = 'ALFA';
UPDATE "companies" SET "sapCode" = '02', "updatedAt" = NOW() WHERE "code" = 'TANGO';
UPDATE "companies" SET "sapCode" = '03', "updatedAt" = NOW() WHERE "code" = 'MONITOREO';
UPDATE "companies" SET "sapCode" = '04', "updatedAt" = NOW() WHERE "code" = 'BENA';
UPDATE "companies" SET "sapCode" = '05', "updatedAt" = NOW() WHERE "code" = 'CONSORCIO';
UPDATE "companies" SET "sapCode" = '09', "updatedAt" = NOW() WHERE "code" = 'ALFATRONIC';
UPDATE "companies" SET "sapCode" = '10', "updatedAt" = NOW() WHERE "code" = 'JOBEN';
UPDATE "companies" SET "sapCode" = '11', "updatedAt" = NOW() WHERE "code" = 'BENLO';
UPDATE "companies" SET "sapCode" = '30', "updatedAt" = NOW() WHERE "code" = 'ACE';

ALTER TABLE "employees" ADD COLUMN "company" TEXT;

ALTER TABLE "employees" ADD CONSTRAINT "employees_company_fkey"
  FOREIGN KEY ("company") REFERENCES "companies"("code") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "employees_company_idx" ON "employees"("company");

ALTER TABLE "employee_placements" ADD COLUMN "company" TEXT;

ALTER TABLE "employee_placements" ADD CONSTRAINT "employee_placements_company_fkey"
  FOREIGN KEY ("company") REFERENCES "companies"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vincular empleados existentes según companySapCode normalizado.
UPDATE "employees" e
SET "company" = c."code"
FROM "companies" c
WHERE e."companySapCode" IS NOT NULL
  AND c."sapCode" = LPAD(REGEXP_REPLACE(TRIM(e."companySapCode"), '[^0-9]', '', 'g'), 2, '0');

UPDATE "employee_placements" p
SET "company" = c."code"
FROM "companies" c
WHERE p."companySapCode" IS NOT NULL
  AND c."sapCode" = LPAD(REGEXP_REPLACE(TRIM(p."companySapCode"), '[^0-9]', '', 'g'), 2, '0');
