-- Vencimiento independiente por administración (emisión).
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN "dueDate" TIMESTAMP(3);
