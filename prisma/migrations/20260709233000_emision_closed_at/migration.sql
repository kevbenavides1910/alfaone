-- Cierre independiente por administración (emisión) en facturación mensual.
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN "closedAt" TIMESTAMP(3);
