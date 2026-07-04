-- Fase B v4.4: exoneraciones, barrio, condiciones venta, emisor tipo ID, IVA devuelto
ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'VENTA_MERCANCIA_NO_NACIONALIZADA';
ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'VENTA_BIENES_USADOS';
ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'ARRENDAMIENTO_OPERATIVO';
ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'ARRENDAMIENTO_FINANCIERO';

ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "tipoIdentificacion" "FeIdentificacionTipo" NOT NULL DEFAULT 'JURIDICA';
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "exigirUbicacionReceptor" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "direccionBarrio" TEXT;

ALTER TABLE "fe_clientes" ADD COLUMN IF NOT EXISTS "direccionBarrio" TEXT;

ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "totalOtrosCargos" DECIMAL(18,5) NOT NULL DEFAULT 0;
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "totalIvaDevuelto" DECIMAL(18,5) NOT NULL DEFAULT 0;

ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "exonTipoDocumento" VARCHAR(2);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "exonNumeroDocumento" VARCHAR(40);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "exonNombreInstitucion" VARCHAR(160);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "exonFechaEmision" TIMESTAMP(3);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "exonPorcentaje" DECIMAL(5,2);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "exonMonto" DECIMAL(18,5);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "ivaCobradoFabrica" VARCHAR(2);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "impuestoAsumidoFabrica" DECIMAL(18,5) NOT NULL DEFAULT 0;
