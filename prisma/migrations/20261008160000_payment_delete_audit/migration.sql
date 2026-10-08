-- La bitácora sobrevive al borrar un pago: paymentId queda null y el texto va en snapshot*.

ALTER TABLE "payment_change_logs" ADD COLUMN "snapshotDescription" TEXT;
ALTER TABLE "payment_change_logs" ADD COLUMN "snapshotCompany" TEXT;
ALTER TABLE "payment_change_logs" ADD COLUMN "snapshotSource" TEXT;

ALTER TABLE "payment_change_logs" ALTER COLUMN "paymentId" DROP NOT NULL;

ALTER TABLE "payment_change_logs" DROP CONSTRAINT "payment_change_logs_paymentId_fkey";

ALTER TABLE "payment_change_logs"
  ADD CONSTRAINT "payment_change_logs_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
