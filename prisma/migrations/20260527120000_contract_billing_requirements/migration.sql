-- CreateTable
CREATE TABLE "contract_billing_requirements" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "contract_billing_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_billing_requirements_contractId_idx" ON "contract_billing_requirements"("contractId");

-- AddForeignKey
ALTER TABLE "contract_billing_requirements" ADD CONSTRAINT "contract_billing_requirements_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
