-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "administrationsCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "contract_billing_lines" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "lineCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(15,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "contract_billing_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_administrations" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "managerName" TEXT NOT NULL DEFAULT '',
    "managerEmail" TEXT,
    "managerPhone" TEXT,
    "zoneId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "contract_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_administration_billing_lines" (
    "administrationId" TEXT NOT NULL,
    "billingLineId" TEXT NOT NULL,

    CONSTRAINT "contract_administration_billing_lines_pkey" PRIMARY KEY ("administrationId","billingLineId")
);

-- CreateIndex
CREATE INDEX "contract_billing_lines_contractId_idx" ON "contract_billing_lines"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_billing_lines_contractId_lineCode_key" ON "contract_billing_lines"("contractId", "lineCode");

-- CreateIndex
CREATE INDEX "contract_administrations_contractId_idx" ON "contract_administrations"("contractId");

-- CreateIndex
CREATE INDEX "contract_administrations_zoneId_idx" ON "contract_administrations"("zoneId");

-- CreateIndex
CREATE INDEX "contract_administration_billing_lines_billingLineId_idx" ON "contract_administration_billing_lines"("billingLineId");

-- AddForeignKey
ALTER TABLE "contract_billing_lines" ADD CONSTRAINT "contract_billing_lines_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_administrations" ADD CONSTRAINT "contract_administrations_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_administrations" ADD CONSTRAINT "contract_administrations_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_administration_billing_lines" ADD CONSTRAINT "contract_administration_billing_lines_administrationId_fkey" FOREIGN KEY ("administrationId") REFERENCES "contract_administrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_administration_billing_lines" ADD CONSTRAINT "contract_administration_billing_lines_billingLineId_fkey" FOREIGN KEY ("billingLineId") REFERENCES "contract_billing_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
