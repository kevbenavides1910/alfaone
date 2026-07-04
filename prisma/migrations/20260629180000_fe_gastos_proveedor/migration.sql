CREATE TABLE IF NOT EXISTS "fe_gastos_proveedor" (
  "id" UUID NOT NULL,
  "empresaId" UUID NOT NULL,
  "comprobanteRecibidoId" UUID NOT NULL,
  "clave" VARCHAR(50) NOT NULL,
  "fechaEmision" TIMESTAMP(3) NOT NULL,
  "cedulaEmisor" TEXT NOT NULL,
  "nombreEmisor" TEXT,
  "tipoComprobante" VARCHAR(64),
  "moneda" "FeMoneda" NOT NULL DEFAULT 'CRC',
  "tipoCambio" DECIMAL(18,5) NOT NULL DEFAULT 1,
  "subtotal" DECIMAL(18,5) NOT NULL,
  "totalDescuentos" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "totalImpuestos" DECIMAL(18,5) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,5) NOT NULL,
  "estadoRecibo" "FeComprobanteRecibidoEstado" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "fe_gastos_proveedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_gastos_proveedor_comprobanteRecibidoId_key"
  ON "fe_gastos_proveedor"("comprobanteRecibidoId");

CREATE INDEX IF NOT EXISTS "fe_gastos_proveedor_empresaId_fechaEmision_idx"
  ON "fe_gastos_proveedor"("empresaId", "fechaEmision");

CREATE INDEX IF NOT EXISTS "fe_gastos_proveedor_deletedAt_idx"
  ON "fe_gastos_proveedor"("deletedAt");

ALTER TABLE "fe_gastos_proveedor"
  DROP CONSTRAINT IF EXISTS "fe_gastos_proveedor_empresaId_fkey";

ALTER TABLE "fe_gastos_proveedor"
  ADD CONSTRAINT "fe_gastos_proveedor_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fe_gastos_proveedor"
  DROP CONSTRAINT IF EXISTS "fe_gastos_proveedor_comprobanteRecibidoId_fkey";

ALTER TABLE "fe_gastos_proveedor"
  ADD CONSTRAINT "fe_gastos_proveedor_comprobanteRecibidoId_fkey"
  FOREIGN KEY ("comprobanteRecibidoId") REFERENCES "fe_comprobantes_recibidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "fe_gasto_proveedor_impuestos" (
  "id" UUID NOT NULL,
  "gastoId" UUID NOT NULL,
  "codigoImpuesto" VARCHAR(2) NOT NULL DEFAULT '01',
  "codigoTarifaIVA" VARCHAR(2) NOT NULL,
  "tarifaPercent" DECIMAL(5,2) NOT NULL,
  "montoImpuesto" DECIMAL(18,5) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fe_gasto_proveedor_impuestos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fe_gasto_proveedor_impuestos_gastoId_idx"
  ON "fe_gasto_proveedor_impuestos"("gastoId");

ALTER TABLE "fe_gasto_proveedor_impuestos"
  DROP CONSTRAINT IF EXISTS "fe_gasto_proveedor_impuestos_gastoId_fkey";

ALTER TABLE "fe_gasto_proveedor_impuestos"
  ADD CONSTRAINT "fe_gasto_proveedor_impuestos_gastoId_fkey"
  FOREIGN KEY ("gastoId") REFERENCES "fe_gastos_proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
