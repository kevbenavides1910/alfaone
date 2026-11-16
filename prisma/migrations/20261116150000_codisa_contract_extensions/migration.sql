-- Extensión Neo/One: campos ausentes en NAF5.ARCOMC (oficiales, puestos, admins, IVA, fin periodo).
CREATE TABLE IF NOT EXISTS "codisa_contract_extensions" (
    "id" TEXT NOT NULL,
    "noCia" VARCHAR(2) NOT NULL,
    "noContrato" VARCHAR(60) NOT NULL,
    "contractId" TEXT,
    "companyCode" TEXT,
    "officersCount" INTEGER,
    "positionsCount" INTEGER,
    "administrationsCount" INTEGER,
    "ivaPct" DECIMAL(5,2),
    "billingPeriodToDay" INTEGER,
    "matchMethod" VARCHAR(30),
    "source" VARCHAR(30) NOT NULL DEFAULT 'alfa_one',
    "lastReconciledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codisa_contract_extensions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "codisa_contract_extensions_noCia_noContrato_key"
  ON "codisa_contract_extensions"("noCia", "noContrato");

CREATE INDEX IF NOT EXISTS "codisa_contract_extensions_contractId_idx"
  ON "codisa_contract_extensions"("contractId");

CREATE INDEX IF NOT EXISTS "codisa_contract_extensions_noContrato_idx"
  ON "codisa_contract_extensions"("noContrato");

CREATE INDEX IF NOT EXISTS "codisa_contract_extensions_companyCode_idx"
  ON "codisa_contract_extensions"("companyCode");

CREATE INDEX IF NOT EXISTS "codisa_contract_extensions_lastReconciledAt_idx"
  ON "codisa_contract_extensions"("lastReconciledAt");

-- Varias filas Codisa pueden apuntar al mismo contrato One (multipart -P/-L).
DO $$ BEGIN
  ALTER TABLE "codisa_contract_extensions" DROP CONSTRAINT IF EXISTS "codisa_contract_extensions_contractId_key";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "codisa_contract_extensions_contractId_key";

DO $$ BEGIN
  ALTER TABLE "codisa_contract_extensions"
    ADD CONSTRAINT "codisa_contract_extensions_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "contracts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
