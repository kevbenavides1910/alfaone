-- Subtotal previo al último cambio de monto aprobado

ALTER TABLE "facturas_mensuales"
  ADD COLUMN IF NOT EXISTS "lastCorrectionPreviousSubtotal" DECIMAL(15, 2);
