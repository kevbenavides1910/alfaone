-- CreateTable
CREATE TABLE "employee_contract_links" (
    "id" TEXT NOT NULL,
    "contratoRrhh" TEXT NOT NULL,
    "contratoRaw" TEXT,
    "contractId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_contract_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_contract_links_contratoRrhh_key" ON "employee_contract_links"("contratoRrhh");

-- CreateIndex
CREATE INDEX "employee_contract_links_contractId_idx" ON "employee_contract_links"("contractId");

-- AddForeignKey
ALTER TABLE "employee_contract_links" ADD CONSTRAINT "employee_contract_links_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
