-- Auditoría de moneda origen (OC Codisa USD/EUR → CRC en amount)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "monedaOrigen" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "montoOriginal" DECIMAL(15,2);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "tipoCambio" DECIMAL(18,5);
