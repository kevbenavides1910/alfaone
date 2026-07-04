-- Buzón IMAP, comprobantes recibidos y proveedores de confianza

CREATE TYPE "FeComprobanteRecibidoEstado" AS ENUM (
  'PENDIENTE',
  'SIN_XML',
  'AUTO_ACEPTADO',
  'ACEPTADO',
  'ACEPTADO_PARCIAL',
  'RECHAZADO',
  'ERROR'
);

CREATE TYPE "FeComprobanteRecibidoOrigen" AS ENUM ('IMAP', 'MANUAL');

ALTER TYPE "FeJobTipo" ADD VALUE IF NOT EXISTS 'PROCESAR_CORREO_ENTRANTE';

ALTER TABLE "fe_empresas"
  ADD COLUMN IF NOT EXISTS "imapEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "imapHost" TEXT,
  ADD COLUMN IF NOT EXISTS "imapPort" INTEGER DEFAULT 993,
  ADD COLUMN IF NOT EXISTS "imapSecure" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "imapUser" TEXT,
  ADD COLUMN IF NOT EXISTS "imapPass" TEXT,
  ADD COLUMN IF NOT EXISTS "imapFolder" TEXT DEFAULT 'INBOX',
  ADD COLUMN IF NOT EXISTS "imapLastUid" INTEGER,
  ADD COLUMN IF NOT EXISTS "imapPuntoVentaId" UUID;

CREATE INDEX IF NOT EXISTS "fe_empresas_imapPuntoVentaId_idx" ON "fe_empresas"("imapPuntoVentaId");

ALTER TABLE "fe_empresas"
  DROP CONSTRAINT IF EXISTS "fe_empresas_imapPuntoVentaId_fkey";

ALTER TABLE "fe_empresas"
  ADD CONSTRAINT "fe_empresas_imapPuntoVentaId_fkey"
  FOREIGN KEY ("imapPuntoVentaId") REFERENCES "fe_puntos_venta"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "fe_proveedores_confianza" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "empresaId" UUID NOT NULL,
  "cedula" VARCHAR(20) NOT NULL,
  "nombre" TEXT,
  "autoAceptar" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "fe_proveedores_confianza_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_proveedores_confianza_empresaId_cedula_key"
  ON "fe_proveedores_confianza"("empresaId", "cedula");

CREATE INDEX IF NOT EXISTS "fe_proveedores_confianza_empresaId_idx"
  ON "fe_proveedores_confianza"("empresaId");

CREATE INDEX IF NOT EXISTS "fe_proveedores_confianza_deletedAt_idx"
  ON "fe_proveedores_confianza"("deletedAt");

ALTER TABLE "fe_proveedores_confianza"
  DROP CONSTRAINT IF EXISTS "fe_proveedores_confianza_empresaId_fkey";

ALTER TABLE "fe_proveedores_confianza"
  ADD CONSTRAINT "fe_proveedores_confianza_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "fe_comprobantes_recibidos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "empresaId" UUID NOT NULL,
  "estado" "FeComprobanteRecibidoEstado" NOT NULL DEFAULT 'PENDIENTE',
  "origen" "FeComprobanteRecibidoOrigen" NOT NULL DEFAULT 'IMAP',
  "clave" VARCHAR(50),
  "cedulaEmisor" TEXT,
  "nombreEmisor" TEXT,
  "consecutivoEmisor" VARCHAR(20),
  "fechaEmision" TIMESTAMP(3),
  "montoTotal" DECIMAL(18,5),
  "montoTotalImpuesto" DECIMAL(18,5),
  "emailMessageId" VARCHAR(500),
  "emailUid" INTEGER,
  "emailSubject" TEXT,
  "emailFrom" TEXT,
  "emailReceivedAt" TIMESTAMP(3),
  "xmlPath" TEXT,
  "pdfPath" TEXT,
  "parsedJson" JSONB,
  "detalleError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "fe_comprobantes_recibidos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_comprobantes_recibidos_empresaId_clave_key"
  ON "fe_comprobantes_recibidos"("empresaId", "clave");

CREATE UNIQUE INDEX IF NOT EXISTS "fe_comprobantes_recibidos_empresaId_emailMessageId_key"
  ON "fe_comprobantes_recibidos"("empresaId", "emailMessageId");

CREATE INDEX IF NOT EXISTS "fe_comprobantes_recibidos_empresaId_estado_idx"
  ON "fe_comprobantes_recibidos"("empresaId", "estado");

CREATE INDEX IF NOT EXISTS "fe_comprobantes_recibidos_deletedAt_idx"
  ON "fe_comprobantes_recibidos"("deletedAt");

ALTER TABLE "fe_comprobantes_recibidos"
  DROP CONSTRAINT IF EXISTS "fe_comprobantes_recibidos_empresaId_fkey";

ALTER TABLE "fe_comprobantes_recibidos"
  ADD CONSTRAINT "fe_comprobantes_recibidos_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fe_mensajes_receptor"
  ADD COLUMN IF NOT EXISTS "comprobanteRecibidoId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "fe_mensajes_receptor_comprobanteRecibidoId_key"
  ON "fe_mensajes_receptor"("comprobanteRecibidoId");

ALTER TABLE "fe_mensajes_receptor"
  DROP CONSTRAINT IF EXISTS "fe_mensajes_receptor_comprobanteRecibidoId_fkey";

ALTER TABLE "fe_mensajes_receptor"
  ADD CONSTRAINT "fe_mensajes_receptor_comprobanteRecibidoId_fkey"
  FOREIGN KEY ("comprobanteRecibidoId") REFERENCES "fe_comprobantes_recibidos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
