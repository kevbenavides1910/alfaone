-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'COMPRAS', 'COMMERCIAL', 'CONSULTA');

-- CreateEnum
CREATE TYPE "CompanyName" AS ENUM ('CONSORCIO', 'MONITOREO', 'TANGO', 'ALFA', 'ALFATRONIC', 'BENLO', 'BENA', 'JOBEN', 'GRUPO', 'ACE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'PROLONGATION', 'SUSPENDED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('UNIFORMS', 'AUDIT_FINDINGS', 'DEFERRED', 'ADMIN', 'TRANSPORT', 'FUEL', 'PHONES', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('APERTURA', 'UNIFORMS', 'AUDIT', 'ADMIN', 'TRANSPORT', 'FUEL', 'PHONES', 'PLANILLA', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseBudgetLine" AS ENUM ('LABOR', 'SUPPLIES', 'ADMIN', 'PROFIT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CONSULTA',
    "company" "CompanyName",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "licitacionNo" TEXT NOT NULL,
    "company" "CompanyName" NOT NULL,
    "client" TEXT NOT NULL,
    "clientType" "ClientType" NOT NULL DEFAULT 'PUBLIC',
    "officersCount" INTEGER NOT NULL DEFAULT 0,
    "positionsCount" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "monthlyBilling" DECIMAL(15,2) NOT NULL,
    "suppliesBudgetPct" DECIMAL(6,4) NOT NULL,
    "equivalencePct" DECIMAL(10,8) NOT NULL DEFAULT 0,
    "laborPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "suppliesPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "adminPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "profitPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_history" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "monthlyBilling" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_periods" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "monthlyBilling" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uniform_expenses" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "shirtQty" INTEGER NOT NULL DEFAULT 0,
    "shirtCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pantsQty" INTEGER NOT NULL DEFAULT 0,
    "pantsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shoesQty" INTEGER NOT NULL DEFAULT 0,
    "shoesCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "capQty" INTEGER NOT NULL DEFAULT 0,
    "capCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vestQty" INTEGER NOT NULL DEFAULT 0,
    "vestCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "beltQty" INTEGER NOT NULL DEFAULT 0,
    "beltCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bootsQty" INTEGER NOT NULL DEFAULT 0,
    "bootsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherQty" INTEGER NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDesc" TEXT,
    "totalCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "uniform_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_findings" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "postName" TEXT NOT NULL,
    "findingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "radioQty" INTEGER NOT NULL DEFAULT 0,
    "radioCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "handcuffsQty" INTEGER NOT NULL DEFAULT 0,
    "handcuffsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "umbrellaQty" INTEGER NOT NULL DEFAULT 0,
    "umbrellaCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "blackjackQty" INTEGER NOT NULL DEFAULT 0,
    "blackjackCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "flashlightQty" INTEGER NOT NULL DEFAULT 0,
    "flashlightCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherQty" INTEGER NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDesc" TEXT,
    "totalCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deferred_expenses" (
    "id" TEXT NOT NULL,
    "company" "CompanyName" NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "isDistributed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "deferred_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deferred_distributions" (
    "id" TEXT NOT NULL,
    "deferredExpenseId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "equivalencePct" DECIMAL(5,4) NOT NULL,
    "allocatedAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deferred_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_expenses" (
    "id" TEXT NOT NULL,
    "company" "CompanyName" NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "transport" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "adminCosts" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "phones" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "phoneLines" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "fuel" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherDesc" TEXT,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isDistributed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "admin_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_distributions" (
    "id" TEXT NOT NULL,
    "adminExpenseId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "equivalencePct" DECIMAL(5,4) NOT NULL,
    "allocatedAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousData" TEXT,
    "newData" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shift" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_type_configs" (
    "id" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-gray-100 text-gray-700',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_origins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "budgetLine" "ExpenseBudgetLine",
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT,
    "positionId" TEXT,
    "originId" TEXT,
    "referenceNumber" TEXT,
    "company" "CompanyName",
    "isDeferred" BOOLEAN NOT NULL DEFAULT false,
    "isDistributed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_distributions" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "equivalencePct" DECIMAL(10,8) NOT NULL,
    "allocatedAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_licitacionNo_key" ON "contracts"("licitacionNo");

-- CreateIndex
CREATE INDEX "contracts_company_idx" ON "contracts"("company");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_deletedAt_idx" ON "contracts"("deletedAt");

-- CreateIndex
CREATE INDEX "contracts_endDate_idx" ON "contracts"("endDate");

-- CreateIndex
CREATE INDEX "billing_history_contractId_idx" ON "billing_history"("contractId");

-- CreateIndex
CREATE INDEX "billing_history_periodMonth_idx" ON "billing_history"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "billing_history_contractId_periodMonth_key" ON "billing_history"("contractId", "periodMonth");

-- CreateIndex
CREATE INDEX "contract_periods_contractId_idx" ON "contract_periods"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_periods_contractId_periodNumber_key" ON "contract_periods"("contractId", "periodNumber");

-- CreateIndex
CREATE INDEX "uniform_expenses_contractId_idx" ON "uniform_expenses"("contractId");

-- CreateIndex
CREATE INDEX "uniform_expenses_periodMonth_idx" ON "uniform_expenses"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "uniform_expenses_contractId_periodMonth_key" ON "uniform_expenses"("contractId", "periodMonth");

-- CreateIndex
CREATE INDEX "audit_findings_contractId_idx" ON "audit_findings"("contractId");

-- CreateIndex
CREATE INDEX "audit_findings_findingDate_idx" ON "audit_findings"("findingDate");

-- CreateIndex
CREATE INDEX "deferred_expenses_company_idx" ON "deferred_expenses"("company");

-- CreateIndex
CREATE INDEX "deferred_distributions_contractId_idx" ON "deferred_distributions"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "deferred_distributions_deferredExpenseId_contractId_key" ON "deferred_distributions"("deferredExpenseId", "contractId");

-- CreateIndex
CREATE INDEX "admin_expenses_company_idx" ON "admin_expenses"("company");

-- CreateIndex
CREATE UNIQUE INDEX "admin_expenses_company_periodMonth_key" ON "admin_expenses"("company", "periodMonth");

-- CreateIndex
CREATE INDEX "admin_distributions_contractId_idx" ON "admin_distributions"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_distributions_adminExpenseId_contractId_key" ON "admin_distributions"("adminExpenseId", "contractId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_contractId_idx" ON "audit_logs"("contractId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "positions_contractId_idx" ON "positions"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_type_configs_type_key" ON "expense_type_configs"("type");

-- CreateIndex
CREATE UNIQUE INDEX "expense_origins_name_key" ON "expense_origins"("name");

-- CreateIndex
CREATE INDEX "expenses_contractId_idx" ON "expenses"("contractId");

-- CreateIndex
CREATE INDEX "expenses_positionId_idx" ON "expenses"("positionId");

-- CreateIndex
CREATE INDEX "expenses_originId_idx" ON "expenses"("originId");

-- CreateIndex
CREATE INDEX "expenses_company_idx" ON "expenses"("company");

-- CreateIndex
CREATE INDEX "expense_distributions_contractId_idx" ON "expense_distributions"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_distributions_expenseId_contractId_key" ON "expense_distributions"("expenseId", "contractId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_periods" ADD CONSTRAINT "contract_periods_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uniform_expenses" ADD CONSTRAINT "uniform_expenses_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deferred_distributions" ADD CONSTRAINT "deferred_distributions_deferredExpenseId_fkey" FOREIGN KEY ("deferredExpenseId") REFERENCES "deferred_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deferred_distributions" ADD CONSTRAINT "deferred_distributions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_distributions" ADD CONSTRAINT "admin_distributions_adminExpenseId_fkey" FOREIGN KEY ("adminExpenseId") REFERENCES "admin_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_distributions" ADD CONSTRAINT "admin_distributions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_originId_fkey" FOREIGN KEY ("originId") REFERENCES "expense_origins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_distributions" ADD CONSTRAINT "expense_distributions_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_distributions" ADD CONSTRAINT "expense_distributions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

