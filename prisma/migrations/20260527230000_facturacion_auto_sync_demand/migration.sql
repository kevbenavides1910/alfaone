-- AlterEnum
ALTER TYPE "FacturaMensualStatus" ADD VALUE 'PENDIENTE_DEFINIR';

-- AlterTable
ALTER TABLE "facturas_mensuales" ADD COLUMN "hiringTypeCopied" "ContractHiringType" NOT NULL DEFAULT 'FIXED';

-- CreateTable
CREATE TABLE "contract_demand_billing" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "monthlyBilling" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "contract_demand_billing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_demand_billing_contractId_periodYear_periodMonth_key" ON "contract_demand_billing"("contractId", "periodYear", "periodMonth");
CREATE INDEX "contract_demand_billing_contractId_idx" ON "contract_demand_billing"("contractId");
CREATE INDEX "contract_demand_billing_periodYear_periodMonth_idx" ON "contract_demand_billing"("periodYear", "periodMonth");

ALTER TABLE "contract_demand_billing" ADD CONSTRAINT "contract_demand_billing_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
