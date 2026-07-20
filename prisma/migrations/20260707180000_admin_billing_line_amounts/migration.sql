-- Monto mensual por línea asignada a cada administración
ALTER TABLE "contract_administration_billing_lines" ADD COLUMN "monthlyAmount" DECIMAL(15,2);
