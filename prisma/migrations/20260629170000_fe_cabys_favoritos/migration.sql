CREATE TABLE IF NOT EXISTS "fe_cabys_favoritos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "empresaId" UUID NOT NULL,
  "codigo" VARCHAR(13) NOT NULL,
  "descripcion" VARCHAR(200) NOT NULL,
  "impuesto" DECIMAL(5, 2),
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "fe_cabys_favoritos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fe_cabys_favoritos_empresaId_codigo_key"
  ON "fe_cabys_favoritos"("empresaId", "codigo");

CREATE INDEX IF NOT EXISTS "fe_cabys_favoritos_empresaId_idx"
  ON "fe_cabys_favoritos"("empresaId");

CREATE INDEX IF NOT EXISTS "fe_cabys_favoritos_deletedAt_idx"
  ON "fe_cabys_favoritos"("deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fe_cabys_favoritos_empresaId_fkey'
  ) THEN
    ALTER TABLE "fe_cabys_favoritos"
      ADD CONSTRAINT "fe_cabys_favoritos_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
