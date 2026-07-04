-- Periodo de facturación por administración (null = hereda del contrato)
ALTER TABLE "contract_administrations"
  ADD COLUMN "billingPeriodFromDay" INTEGER,
  ADD COLUMN "billingPeriodToDay" INTEGER;

-- Copia del periodo en cada emisión de factura mensual
ALTER TABLE "factura_mensual_emisiones"
  ADD COLUMN "billingPeriodFromDayCopied" INTEGER,
  ADD COLUMN "billingPeriodToDayCopied" INTEGER;
