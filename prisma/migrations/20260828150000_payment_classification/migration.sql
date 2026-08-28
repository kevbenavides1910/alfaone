-- Clasificación de pagos (categoría / subcategoría de gastos reales)
ALTER TABLE "payments" ADD COLUMN "category" TEXT;
ALTER TABLE "payments" ADD COLUMN "subcategory" TEXT;

CREATE INDEX "payments_category_subcategory_idx" ON "payments"("category", "subcategory");
