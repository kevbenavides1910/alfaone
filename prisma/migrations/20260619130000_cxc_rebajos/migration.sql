-- Rebajos / justificación de diferencia en cuentas por cobrar
CREATE TABLE "cxc_rebajos" (
    "id" TEXT NOT NULL,
    "cxcDocumentoId" TEXT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cxc_rebajos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cxc_rebajos_cxcDocumentoId_idx" ON "cxc_rebajos"("cxcDocumentoId");

ALTER TABLE "cxc_rebajos" ADD CONSTRAINT "cxc_rebajos_cxcDocumentoId_fkey" FOREIGN KEY ("cxcDocumentoId") REFERENCES "cxc_documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
