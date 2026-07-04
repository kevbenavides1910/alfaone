-- CreateTable
CREATE TABLE "contract_special_services" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "contract_special_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_special_services_contractId_idx" ON "contract_special_services"("contractId");

-- CreateIndex
CREATE INDEX "contract_special_services_contractId_periodMonth_idx" ON "contract_special_services"("contractId", "periodMonth");

-- AddForeignKey
ALTER TABLE "contract_special_services" ADD CONSTRAINT "contract_special_services_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
