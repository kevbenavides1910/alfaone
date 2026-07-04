-- Parametrización general de presupuestos + overrides por presupuesto
ALTER TABLE "ventas_presupuestos" ADD COLUMN IF NOT EXISTS "catalogOverrides" JSONB;

CREATE TABLE IF NOT EXISTS "ventas_presupuesto_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "compania" TEXT NOT NULL DEFAULT 'SEGURIDAD TANGO S.A',
    "anioBase" INTEGER NOT NULL DEFAULT 2026,
    "polizaInsPct" DECIMAL(8,4) NOT NULL DEFAULT 5.75,
    "ivaPct" DECIMAL(8,4) NOT NULL DEFAULT 13,
    "margenUtilidadPct" DECIMAL(12,8) NOT NULL DEFAULT 7.523687797366793,
    "imprevistosPct" DECIMAL(8,4) NOT NULL DEFAULT 0.01,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ventas_presupuesto_config_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ventas_presupuesto_config" ("id", "compania", "anioBase", "polizaInsPct", "ivaPct", "margenUtilidadPct", "imprevistosPct", "updatedAt", "createdAt")
VALUES ('default', 'SEGURIDAD TANGO S.A', 2026, 5.75, 13, 7.523687797366793, 0.01, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
