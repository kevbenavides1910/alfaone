-- Bitácora de cambios del calendario de pagos
CREATE TABLE "payment_change_logs" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_change_logs_paymentId_createdAt_idx" ON "payment_change_logs"("paymentId", "createdAt");
CREATE INDEX "payment_change_logs_changedById_idx" ON "payment_change_logs"("changedById");

ALTER TABLE "payment_change_logs" ADD CONSTRAINT "payment_change_logs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_change_logs" ADD CONSTRAINT "payment_change_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
