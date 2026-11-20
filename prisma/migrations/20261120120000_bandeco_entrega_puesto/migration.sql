-- Checklist de entrega y recepción de puesto (cambio de turno, monitoreo).
CREATE TABLE "bandeco_entrega_puestos" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" TEXT NOT NULL,
    "saliente" TEXT NOT NULL,
    "entrante" TEXT NOT NULL,
    "observaciones" TEXT,
    "checks" JSONB NOT NULL,
    "sourceId" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bandeco_entrega_puestos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bandeco_entrega_puestos_sourceId_key" ON "bandeco_entrega_puestos"("sourceId");
CREATE INDEX "bandeco_entrega_puestos_fecha_idx" ON "bandeco_entrega_puestos"("fecha");
CREATE INDEX "bandeco_entrega_puestos_createdAt_idx" ON "bandeco_entrega_puestos"("createdAt");
