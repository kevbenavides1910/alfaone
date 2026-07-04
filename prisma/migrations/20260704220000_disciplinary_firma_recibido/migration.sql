-- Firma dibujada del oficial en apercibimientos (Recibido por)
ALTER TABLE "disciplinary_apercibimientos"
  ADD COLUMN IF NOT EXISTS "firmaRecibidoPath" TEXT,
  ADD COLUMN IF NOT EXISTS "firmaRecibidoAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "correoFirmadoEnviadoAt" TIMESTAMP(3);
