ALTER TABLE "contract_billing_lines" ADD COLUMN IF NOT EXISTS "appliesIva" BOOLEAN NOT NULL DEFAULT true;

UPDATE "contract_billing_lines"
SET "appliesIva" = false
WHERE lower("description") LIKE '%sin iva%';
