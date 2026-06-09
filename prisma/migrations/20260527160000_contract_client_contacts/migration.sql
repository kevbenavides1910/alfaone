-- CreateTable
CREATE TABLE "contract_client_contacts" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "isBillingContact" BOOLEAN NOT NULL DEFAULT false,
    "isContractAdmin" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT NOT NULL,
    "phone2" TEXT,
    "email" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "contract_client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_client_contacts_contractId_idx" ON "contract_client_contacts"("contractId");

-- AddForeignKey
ALTER TABLE "contract_client_contacts" ADD CONSTRAINT "contract_client_contacts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
