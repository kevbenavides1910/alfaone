-- Rename permission keys bandeco.* → monitoreo.*
UPDATE "role_permissions"
SET "permissionKey" = REPLACE("permissionKey", 'bandeco.', 'monitoreo.')
WHERE "permissionKey" LIKE 'bandeco.%';

-- Fotos en informes de activación / evento
ALTER TABLE "bandeco_activaciones" ADD COLUMN IF NOT EXISTS "imagenes" JSONB;
ALTER TABLE "bandeco_eventos" ADD COLUMN IF NOT EXISTS "imagenes" JSONB;

-- Registro diario de llenado de pilas
CREATE TABLE IF NOT EXISTS "bandeco_pila_llenados" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "finca" TEXT NOT NULL,
    "pilaFincaId" TEXT,
    "desmane" TEXT,
    "paneo" TEXT,
    "observaciones" TEXT,
    "recomendaciones" TEXT,
    "operadorName" TEXT NOT NULL,
    "operadorId" TEXT,
    "imagenes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bandeco_pila_llenados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bandeco_pila_llenados_fecha_finca_key"
  ON "bandeco_pila_llenados"("fecha", "finca");

CREATE INDEX IF NOT EXISTS "bandeco_pila_llenados_fecha_idx"
  ON "bandeco_pila_llenados"("fecha");

CREATE INDEX IF NOT EXISTS "bandeco_pila_llenados_finca_idx"
  ON "bandeco_pila_llenados"("finca");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bandeco_pila_llenados_pilaFincaId_fkey'
  ) THEN
    ALTER TABLE "bandeco_pila_llenados"
      ADD CONSTRAINT "bandeco_pila_llenados_pilaFincaId_fkey"
      FOREIGN KEY ("pilaFincaId") REFERENCES "bandeco_pila_fincas"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
