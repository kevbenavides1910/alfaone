-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('EXPENSE', 'APEX', 'MANUAL');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "expenseId" TEXT,
    "apexPagoId" INTEGER,
    "apexPagoBaseId" INTEGER,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "company" TEXT,
    "refType" TEXT,
    "referenceNumber" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");
CREATE INDEX "payments_company_idx" ON "payments"("company");
CREATE INDEX "payments_paid_idx" ON "payments"("paid");
CREATE UNIQUE INDEX "payments_apexPagoId_source_key" ON "payments"("apexPagoId", "source");

-- ForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
