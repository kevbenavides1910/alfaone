-- Netos NAF por emisión/administración
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN IF NOT EXISTS "subtotalFacturadoNaf" DECIMAL(15,2);
ALTER TABLE "factura_mensual_emisiones" ADD COLUMN IF NOT EXISTS "totalFacturadoNaf" DECIMAL(15,2);

-- Documentos NAF ligados a una emisión
CREATE TABLE IF NOT EXISTS "factura_emision_naf_documentos" (
    "id" TEXT NOT NULL,
    "facturaMensualEmisionId" TEXT NOT NULL,
    "nafNoCia" TEXT NOT NULL,
    "nafTipoDoc" TEXT NOT NULL,
    "nafNoFactu" TEXT NOT NULL,
    "nafNoFisico" TEXT,
    "nafSerieFisico" TEXT,
    "nafConsecutivoFe" TEXT,
    "nafClaveFactura" TEXT,
    "nafFecha" TIMESTAMP(3),
    "subtotal" DECIMAL(15,2) NOT NULL,
    "impuesto" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "amountSign" INTEGER NOT NULL,
    "signedTotal" DECIMAL(15,2) NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedById" TEXT,

    CONSTRAINT "factura_emision_naf_documentos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "factura_emision_naf_documentos_nafNoCia_nafTipoDoc_nafNoFactu_key"
  ON "factura_emision_naf_documentos"("nafNoCia", "nafTipoDoc", "nafNoFactu");

CREATE INDEX IF NOT EXISTS "factura_emision_naf_documentos_facturaMensualEmisionId_idx"
  ON "factura_emision_naf_documentos"("facturaMensualEmisionId");

CREATE INDEX IF NOT EXISTS "factura_emision_naf_documentos_linkedById_idx"
  ON "factura_emision_naf_documentos"("linkedById");

ALTER TABLE "factura_emision_naf_documentos"
  DROP CONSTRAINT IF EXISTS "factura_emision_naf_documentos_facturaMensualEmisionId_fkey";
ALTER TABLE "factura_emision_naf_documentos"
  ADD CONSTRAINT "factura_emision_naf_documentos_facturaMensualEmisionId_fkey"
  FOREIGN KEY ("facturaMensualEmisionId") REFERENCES "factura_mensual_emisiones"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "factura_emision_naf_documentos"
  DROP CONSTRAINT IF EXISTS "factura_emision_naf_documentos_linkedById_fkey";
ALTER TABLE "factura_emision_naf_documentos"
  ADD CONSTRAINT "factura_emision_naf_documentos_linkedById_fkey"
  FOREIGN KEY ("linkedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
