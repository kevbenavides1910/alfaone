-- Campos operativos para mensaje receptor (emisor del comprobante recibido, empresa y terminal).
ALTER TABLE "fe_mensajes_receptor" ADD COLUMN IF NOT EXISTS "empresaId" UUID;
ALTER TABLE "fe_mensajes_receptor" ADD COLUMN IF NOT EXISTS "puntoVentaId" UUID;
ALTER TABLE "fe_mensajes_receptor" ADD COLUMN IF NOT EXISTS "cedulaEmisor" TEXT;

UPDATE "fe_mensajes_receptor" SET "cedulaEmisor" = '' WHERE "cedulaEmisor" IS NULL;

ALTER TABLE "fe_mensajes_receptor" ALTER COLUMN "cedulaEmisor" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fe_mensajes_receptor_empresaId_fkey'
  ) THEN
    ALTER TABLE "fe_mensajes_receptor"
      ADD CONSTRAINT "fe_mensajes_receptor_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fe_mensajes_receptor_puntoVentaId_fkey'
  ) THEN
    ALTER TABLE "fe_mensajes_receptor"
      ADD CONSTRAINT "fe_mensajes_receptor_puntoVentaId_fkey"
      FOREIGN KEY ("puntoVentaId") REFERENCES "fe_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "fe_mensajes_receptor_empresaId_idx" ON "fe_mensajes_receptor"("empresaId");
