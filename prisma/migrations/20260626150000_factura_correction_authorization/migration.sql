-- Autorización para regresar facturas + trazabilidad de correcciones

ALTER TABLE "app_facturacion_cobro_settings"
  ADD COLUMN IF NOT EXISTS "invoiceModificationAuthorizedUserId" TEXT;

ALTER TABLE "facturas_mensuales"
  ADD COLUMN IF NOT EXISTS "correctionReturnCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastCorrectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lastCorrectionReturnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastCorrectionReturnedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_facturacion_cobro_settings_invoiceModificationAuthorizedUserId_fkey'
  ) THEN
    ALTER TABLE "app_facturacion_cobro_settings"
      ADD CONSTRAINT "app_facturacion_cobro_settings_invoiceModificationAuthorizedUserId_fkey"
      FOREIGN KEY ("invoiceModificationAuthorizedUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_mensuales_lastCorrectionReturnedById_fkey'
  ) THEN
    ALTER TABLE "facturas_mensuales"
      ADD CONSTRAINT "facturas_mensuales_lastCorrectionReturnedById_fkey"
      FOREIGN KEY ("lastCorrectionReturnedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
