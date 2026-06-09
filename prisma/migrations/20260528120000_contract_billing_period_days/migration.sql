-- Período de servicio facturado (días del mes, ej. del 14 al 1).
ALTER TABLE "contracts" ADD COLUMN "billingPeriodFromDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "contracts" ADD COLUMN "billingPeriodToDay" INTEGER NOT NULL DEFAULT 31;
