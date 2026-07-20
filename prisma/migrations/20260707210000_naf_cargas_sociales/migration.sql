CREATE TABLE "naf_cargas_sociales" (
    "id" TEXT NOT NULL,
    "noCia" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL(8,4) NOT NULL,
    "grupo" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naf_cargas_sociales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "naf_cargas_sociales_noCia_codigo_key" ON "naf_cargas_sociales"("noCia", "codigo");
CREATE INDEX "naf_cargas_sociales_noCia_idx" ON "naf_cargas_sociales"("noCia");
