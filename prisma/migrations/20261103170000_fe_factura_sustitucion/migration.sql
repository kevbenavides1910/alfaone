-- Referencia opcional cuando una factura sustituye otro comprobante (anexo 4.4, nov 2026).
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "claveReferencia" VARCHAR(50);
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "tipoDocReferencia" VARCHAR(2);
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "codigoReferencia" VARCHAR(2);
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "fechaReferencia" TIMESTAMP(3);
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "razonReferencia" VARCHAR(180);
