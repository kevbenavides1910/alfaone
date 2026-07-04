-- NC/ND sobre FEC y REP
CREATE TYPE "FeNotaReferenciaTipo" AS ENUM ('FACTURA_VENTA', 'FACTURA_COMPRA', 'RECIBO_PAGO');

ALTER TABLE "fe_notas_credito" ADD COLUMN IF NOT EXISTS "referenciaTipo" "FeNotaReferenciaTipo" NOT NULL DEFAULT 'FACTURA_VENTA';
ALTER TABLE "fe_notas_credito" ADD COLUMN IF NOT EXISTS "facturaCompraReferenciaId" UUID;
ALTER TABLE "fe_notas_credito" ADD COLUMN IF NOT EXISTS "reciboPagoReferenciaId" UUID;
ALTER TABLE "fe_notas_credito" ADD COLUMN IF NOT EXISTS "tipoDocReferencia" VARCHAR(2) NOT NULL DEFAULT '01';

ALTER TABLE "fe_notas_debito" ADD COLUMN IF NOT EXISTS "referenciaTipo" "FeNotaReferenciaTipo" NOT NULL DEFAULT 'FACTURA_VENTA';
ALTER TABLE "fe_notas_debito" ADD COLUMN IF NOT EXISTS "facturaCompraReferenciaId" UUID;
ALTER TABLE "fe_notas_debito" ADD COLUMN IF NOT EXISTS "reciboPagoReferenciaId" UUID;
ALTER TABLE "fe_notas_debito" ADD COLUMN IF NOT EXISTS "tipoDocReferencia" VARCHAR(2) NOT NULL DEFAULT '01';

ALTER TABLE "fe_notas_credito" ALTER COLUMN "facturaReferenciaId" DROP NOT NULL;
ALTER TABLE "fe_notas_debito" ALTER COLUMN "facturaReferenciaId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "fe_notas_credito_facturaCompraReferenciaId_idx" ON "fe_notas_credito"("facturaCompraReferenciaId");
CREATE INDEX IF NOT EXISTS "fe_notas_credito_reciboPagoReferenciaId_idx" ON "fe_notas_credito"("reciboPagoReferenciaId");
CREATE INDEX IF NOT EXISTS "fe_notas_debito_facturaCompraReferenciaId_idx" ON "fe_notas_debito"("facturaCompraReferenciaId");
CREATE INDEX IF NOT EXISTS "fe_notas_debito_reciboPagoReferenciaId_idx" ON "fe_notas_debito"("reciboPagoReferenciaId");

ALTER TABLE "fe_notas_credito" ADD CONSTRAINT "fe_notas_credito_facturaCompraReferenciaId_fkey"
  FOREIGN KEY ("facturaCompraReferenciaId") REFERENCES "fe_facturas_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_notas_credito" ADD CONSTRAINT "fe_notas_credito_reciboPagoReferenciaId_fkey"
  FOREIGN KEY ("reciboPagoReferenciaId") REFERENCES "fe_recibos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fe_notas_debito" ADD CONSTRAINT "fe_notas_debito_facturaCompraReferenciaId_fkey"
  FOREIGN KEY ("facturaCompraReferenciaId") REFERENCES "fe_facturas_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_notas_debito" ADD CONSTRAINT "fe_notas_debito_reciboPagoReferenciaId_fkey"
  FOREIGN KEY ("reciboPagoReferenciaId") REFERENCES "fe_recibos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
