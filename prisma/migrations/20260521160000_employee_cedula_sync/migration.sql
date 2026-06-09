-- AlterTable
ALTER TABLE "employees" ADD COLUMN "cedulaNormalizada" TEXT;

-- AlterTable
ALTER TABLE "employee_import_batches" ADD COLUMN "employeesDeactivated" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "employees_cedulaNormalizada_idx" ON "employees"("cedulaNormalizada");
