-- CreateTable
CREATE TABLE "contract_month_labor_cache" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "laborSpend" DECIMAL(18,2) NOT NULL,
    "cargasSocialesSpend" DECIMAL(18,2) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_month_labor_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_month_labor_cache_year_month_idx" ON "contract_month_labor_cache"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "contract_month_labor_cache_contractId_year_month_key" ON "contract_month_labor_cache"("contractId", "year", "month");

-- AddForeignKey
ALTER TABLE "contract_month_labor_cache" ADD CONSTRAINT "contract_month_labor_cache_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
