-- Abonos parciales en cuentas por cobrar (varios por documento)
CREATE TABLE "cxc_abonos" (
    "id" TEXT NOT NULL,
    "cxcDocumentoId" TEXT NOT NULL,
    "receiptNumber" VARCHAR(100),
    "amount" DECIMAL(15,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cxc_abonos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cxc_abonos_cxcDocumentoId_idx" ON "cxc_abonos"("cxcDocumentoId");

ALTER TABLE "cxc_abonos" ADD CONSTRAINT "cxc_abonos_cxcDocumentoId_fkey" FOREIGN KEY ("cxcDocumentoId") REFERENCES "cxc_documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar abono provisional único existente al nuevo modelo
INSERT INTO "cxc_abonos" ("id", "cxcDocumentoId", "receiptNumber", "amount", "paidAt", "sortOrder", "createdAt", "updatedAt")
SELECT
    'legacy_' || d."id",
    d."id",
    d."provisionalReceiptNumber",
    d."provisionalPaymentAmount",
    d."paidAt",
    0,
    COALESCE(d."updatedAt", CURRENT_TIMESTAMP),
    COALESCE(d."updatedAt", CURRENT_TIMESTAMP)
FROM "cxc_documentos" d
WHERE d."provisionalPaymentAmount" IS NOT NULL
  AND d."provisionalPaymentAmount" > 0
ON CONFLICT DO NOTHING;
