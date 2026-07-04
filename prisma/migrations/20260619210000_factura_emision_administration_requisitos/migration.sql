-- AlterTable
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN "contractAdministrationId" TEXT;
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN "administrationNameCopied" TEXT;
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN "managerNameCopied" TEXT;
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN "zoneNameCopied" TEXT;

-- AlterTable
ALTER TABLE "factura_requisitos" ADD COLUMN "facturaMensualEmisionId" TEXT;

-- CreateIndex
CREATE INDEX "factura_mensual_emisiones_contractAdministrationId_idx" ON "factura_mensual_emisiones"("contractAdministrationId");

-- CreateIndex
CREATE INDEX "factura_requisitos_facturaMensualEmisionId_idx" ON "factura_requisitos"("facturaMensualEmisionId");

-- AddForeignKey
ALTER TABLE "factura_mensual_emisiones" ADD CONSTRAINT "factura_mensual_emisiones_contractAdministrationId_fkey" FOREIGN KEY ("contractAdministrationId") REFERENCES "contract_administrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_requisitos" ADD CONSTRAINT "factura_requisitos_facturaMensualEmisionId_fkey" FOREIGN KEY ("facturaMensualEmisionId") REFERENCES "factura_mensual_emisiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Asignar requisitos existentes a la primera emisión de cada factura
UPDATE "factura_requisitos" fr
SET "facturaMensualEmisionId" = sub.emision_id
FROM (
  SELECT DISTINCT ON (e."facturaMensualId")
    e."facturaMensualId",
    e.id AS emision_id
  FROM "factura_mensual_emisiones" e
  ORDER BY e."facturaMensualId", e."sortOrder" ASC
) sub
WHERE fr."facturaMensualId" = sub."facturaMensualId"
  AND fr."facturaMensualEmisionId" IS NULL;
