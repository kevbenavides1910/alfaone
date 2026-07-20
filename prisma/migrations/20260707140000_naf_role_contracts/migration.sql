CREATE TABLE "naf_role_contracts" (
    "id" TEXT NOT NULL,
    "noCiaGrupo" TEXT NOT NULL,
    "noRol" TEXT NOT NULL,
    "noContrato" TEXT NOT NULL,
    "noUbicacion" TEXT,
    "estado" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naf_role_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "naf_role_contracts_noCiaGrupo_noRol_noContrato_noUbicacion_key"
    ON "naf_role_contracts"("noCiaGrupo", "noRol", "noContrato", "noUbicacion");

CREATE INDEX "naf_role_contracts_noRol_idx" ON "naf_role_contracts"("noRol");
CREATE INDEX "naf_role_contracts_noContrato_idx" ON "naf_role_contracts"("noContrato");
