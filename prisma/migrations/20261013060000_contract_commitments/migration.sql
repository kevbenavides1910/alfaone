-- Compromisos periódicos que exige el cartel/pliego de cada contrato (extraídos con cita y página del documento)
CREATE TABLE IF NOT EXISTS "contract_commitments" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "tema" TEXT NOT NULL,
  "subtipo" TEXT,
  "obligacion" TEXT NOT NULL,
  "frecuencia" TEXT NOT NULL,
  "meses" DOUBLE PRECISION,
  "pagina" INTEGER,
  "documento" TEXT,
  "citasAdicionales" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_commitments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_commitments_contractId_idx" ON "contract_commitments"("contractId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contract_commitments_contractId_fkey'
  ) THEN
    ALTER TABLE "contract_commitments"
      ADD CONSTRAINT "contract_commitments_contractId_fkey"
      FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
