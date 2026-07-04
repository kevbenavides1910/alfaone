-- Fase A v4.4: proveedor sistemas, actividad receptor, medios pago, descuentos línea
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "proveedorSistemas" VARCHAR(20);

ALTER TABLE "fe_clientes" ADD COLUMN IF NOT EXISTS "actividadEconomica" VARCHAR(20);

ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "condicionVentaOtro" VARCHAR(100);
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "medioPagoOtro" VARCHAR(100);
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "mediosPago" JSONB;

ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "codigoDescuento" VARCHAR(2);
ALTER TABLE "fe_factura_detalles" ADD COLUMN IF NOT EXISTS "naturalezaDescuento" VARCHAR(80);
