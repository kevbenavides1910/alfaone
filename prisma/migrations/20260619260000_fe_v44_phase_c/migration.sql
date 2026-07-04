-- Fase C v4.4: TE, FEE, FEC, REP
ALTER TYPE "FeComprobanteTipo" ADD VALUE IF NOT EXISTS 'FACTURA_ELECTRONICA_EXPORTACION';
ALTER TYPE "FeComprobanteTipo" ADD VALUE IF NOT EXISTS 'FACTURA_ELECTRONICA_COMPRA';
ALTER TYPE "FeComprobanteTipo" ADD VALUE IF NOT EXISTS 'RECIBO_ELECTRONICO_PAGO';

ALTER TYPE "FeIdentificacionTipo" ADD VALUE IF NOT EXISTS 'NO_CONTRIBUYENTE';

ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'PAGO_SERVICIOS_ESTADO';
ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'VENTA_CREDITO_IVA_90_DIAS';
ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'PAGO_VENTA_PARCELADO';
ALTER TYPE "FeCondicionVenta" ADD VALUE IF NOT EXISTS 'PAGO_VENTA_CREDITO';

ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "tipoDocumento" "FeComprobanteTipo" NOT NULL DEFAULT 'FACTURA_ELECTRONICA';
ALTER TABLE "fe_facturas" ALTER COLUMN "clienteId" DROP NOT NULL;

ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "partidaArancelaria" VARCHAR(12);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "montoImpuestoExportacion" DECIMAL(18,5);

CREATE INDEX IF NOT EXISTS "fe_facturas_empresaId_tipoDocumento_idx" ON "fe_facturas"("empresaId", "tipoDocumento");

CREATE TABLE IF NOT EXISTS "fe_facturas_compra" (
  "id" UUID NOT NULL,
  "empresaId" UUID NOT NULL,
  "puntoVentaId" UUID NOT NULL,
  "comprobanteId" UUID,
  "fecha" TIMESTAMP(3) NOT NULL,
  "moneda" "FeMoneda" NOT NULL DEFAULT 'CRC',
  "tipoCambio" DECIMAL(18,5) NOT NULL DEFAULT 1,
  "condicionVenta" "FeCondicionVenta" NOT NULL DEFAULT 'CONTADO',
  "proveedorTipoIdentificacion" "FeIdentificacionTipo" NOT NULL,
  "proveedorIdentificacion" TEXT NOT NULL,
  "proveedorNombre" TEXT NOT NULL,
  "proveedorOtrasSenasExtranjero" VARCHAR(300),
  "claveReferencia" VARCHAR(50),
  "codigoReferencia" VARCHAR(2) NOT NULL DEFAULT '16',
  "subtotal" DECIMAL(18,5) NOT NULL,
  "totalDescuentos" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "totalImpuestos" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,5) NOT NULL,
  "observaciones" TEXT,
  "estado" "FeFacturaEstado" NOT NULL DEFAULT 'BORRADOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "fe_facturas_compra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_facturas_compra_comprobanteId_key" ON "fe_facturas_compra"("comprobanteId");
CREATE INDEX IF NOT EXISTS "fe_facturas_compra_empresaId_fecha_idx" ON "fe_facturas_compra"("empresaId", "fecha");
CREATE INDEX IF NOT EXISTS "fe_facturas_compra_empresaId_estado_idx" ON "fe_facturas_compra"("empresaId", "estado");
CREATE INDEX IF NOT EXISTS "fe_facturas_compra_deletedAt_idx" ON "fe_facturas_compra"("deletedAt");

CREATE TABLE IF NOT EXISTS "fe_factura_compra_detalles" (
  "id" UUID NOT NULL,
  "facturaCompraId" UUID NOT NULL,
  "numeroLinea" INTEGER NOT NULL,
  "codigoCabys" VARCHAR(13),
  "descripcion" TEXT NOT NULL,
  "cantidad" DECIMAL(18,5) NOT NULL,
  "unidadMedida" VARCHAR(10) NOT NULL,
  "precioUnitario" DECIMAL(18,5) NOT NULL,
  "montoDescuento" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "codigoImpuesto" VARCHAR(2) NOT NULL DEFAULT '08',
  "tarifaImpuesto" DECIMAL(5,2) NOT NULL DEFAULT 13,
  "montoImpuesto" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "totalLinea" DECIMAL(18,5) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "fe_factura_compra_detalles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_factura_compra_detalles_facturaCompraId_numeroLinea_key"
  ON "fe_factura_compra_detalles"("facturaCompraId", "numeroLinea");
CREATE INDEX IF NOT EXISTS "fe_factura_compra_detalles_facturaCompraId_idx"
  ON "fe_factura_compra_detalles"("facturaCompraId");

CREATE TABLE IF NOT EXISTS "fe_recibos_pago" (
  "id" UUID NOT NULL,
  "empresaId" UUID NOT NULL,
  "puntoVentaId" UUID NOT NULL,
  "comprobanteId" UUID,
  "facturaReferenciaId" UUID,
  "claveReferencia" VARCHAR(50) NOT NULL,
  "codigoReferencia" VARCHAR(2) NOT NULL DEFAULT '01',
  "tipoDocReferencia" VARCHAR(2) NOT NULL DEFAULT '01',
  "fechaReferencia" TIMESTAMP(3),
  "razon" TEXT,
  "condicionVenta" "FeCondicionVenta" NOT NULL,
  "medioPago" "FeMedioPago" NOT NULL,
  "medioPagoOtro" VARCHAR(100),
  "subtotal" DECIMAL(18,5) NOT NULL,
  "totalImpuestos" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,5) NOT NULL,
  "estado" "FeFacturaEstado" NOT NULL DEFAULT 'BORRADOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "fe_recibos_pago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_recibos_pago_comprobanteId_key" ON "fe_recibos_pago"("comprobanteId");
CREATE INDEX IF NOT EXISTS "fe_recibos_pago_empresaId_estado_idx" ON "fe_recibos_pago"("empresaId", "estado");
CREATE INDEX IF NOT EXISTS "fe_recibos_pago_facturaReferenciaId_idx" ON "fe_recibos_pago"("facturaReferenciaId");
CREATE INDEX IF NOT EXISTS "fe_recibos_pago_deletedAt_idx" ON "fe_recibos_pago"("deletedAt");

CREATE TABLE IF NOT EXISTS "fe_recibo_pago_detalles" (
  "id" UUID NOT NULL,
  "reciboPagoId" UUID NOT NULL,
  "numeroLinea" INTEGER NOT NULL,
  "descripcion" TEXT NOT NULL,
  "subTotal" DECIMAL(18,5) NOT NULL,
  "tarifaImpuesto" DECIMAL(5,2) NOT NULL DEFAULT 13,
  "montoImpuesto" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "totalLinea" DECIMAL(18,5) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "fe_recibo_pago_detalles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_recibo_pago_detalles_reciboPagoId_numeroLinea_key"
  ON "fe_recibo_pago_detalles"("reciboPagoId", "numeroLinea");
CREATE INDEX IF NOT EXISTS "fe_recibo_pago_detalles_reciboPagoId_idx"
  ON "fe_recibo_pago_detalles"("reciboPagoId");

DO $$ BEGIN
  ALTER TABLE "fe_facturas_compra" ADD CONSTRAINT "fe_facturas_compra_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_facturas_compra" ADD CONSTRAINT "fe_facturas_compra_puntoVentaId_fkey"
    FOREIGN KEY ("puntoVentaId") REFERENCES "fe_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_facturas_compra" ADD CONSTRAINT "fe_facturas_compra_comprobanteId_fkey"
    FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_factura_compra_detalles" ADD CONSTRAINT "fe_factura_compra_detalles_facturaCompraId_fkey"
    FOREIGN KEY ("facturaCompraId") REFERENCES "fe_facturas_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_recibos_pago" ADD CONSTRAINT "fe_recibos_pago_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_recibos_pago" ADD CONSTRAINT "fe_recibos_pago_puntoVentaId_fkey"
    FOREIGN KEY ("puntoVentaId") REFERENCES "fe_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_recibos_pago" ADD CONSTRAINT "fe_recibos_pago_facturaReferenciaId_fkey"
    FOREIGN KEY ("facturaReferenciaId") REFERENCES "fe_facturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_recibos_pago" ADD CONSTRAINT "fe_recibos_pago_comprobanteId_fkey"
    FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fe_recibo_pago_detalles" ADD CONSTRAINT "fe_recibo_pago_detalles_reciboPagoId_fkey"
    FOREIGN KEY ("reciboPagoId") REFERENCES "fe_recibos_pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "fe_consecutivos" ("id", "puntoVentaId", "tipoComprobante", "ultimoNumero", "version", "createdAt", "updatedAt")
SELECT gen_random_uuid(), pv."id", t.tipo::"FeComprobanteTipo", 0, 0, NOW(), NOW()
FROM "fe_puntos_venta" pv
CROSS JOIN (
  VALUES
    ('TIQUETE_ELECTRONICO'),
    ('FACTURA_ELECTRONICA_EXPORTACION'),
    ('FACTURA_ELECTRONICA_COMPRA'),
    ('RECIBO_ELECTRONICO_PAGO')
) AS t(tipo)
WHERE pv."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "fe_consecutivos" c
    WHERE c."puntoVentaId" = pv."id"
      AND c."tipoComprobante" = t.tipo::"FeComprobanteTipo"
      AND c."deletedAt" IS NULL
  );
