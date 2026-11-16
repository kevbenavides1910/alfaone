-- Alias One/Neo → nombre canónico Codisa (renovaciones ".", multipart -P/-L).
CREATE TABLE IF NOT EXISTS "codisa_contract_aliases" (
    "id" TEXT NOT NULL,
    "licitacionNoOne" TEXT NOT NULL,
    "companyOne" TEXT,
    "noCia" VARCHAR(2) NOT NULL,
    "noContrato" VARCHAR(60) NOT NULL,
    "aliasNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codisa_contract_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "codisa_contract_aliases_one_codisa_key"
  ON "codisa_contract_aliases"("licitacionNoOne", "noCia", "noContrato");

CREATE INDEX IF NOT EXISTS "codisa_contract_aliases_nocontrato_idx"
  ON "codisa_contract_aliases"("noContrato");
