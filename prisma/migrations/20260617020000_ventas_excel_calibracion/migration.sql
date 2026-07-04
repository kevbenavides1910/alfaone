-- AlterTable
ALTER TABLE "ventas_jornada_tipos" ADD COLUMN "costoMoReferencia" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "ventas_insumo_variantes" (
    "id" TEXT NOT NULL,
    "codigoHoja" TEXT NOT NULL,
    "equipamiento" "VentasEquipamiento" NOT NULL,
    "factorOficiales" DECIMAL(8,4) NOT NULL,
    "montoMensual" DECIMAL(15,2) NOT NULL,
    "descripcion" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_insumo_variantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_insumo_variantes_codigoHoja_key" ON "ventas_insumo_variantes"("codigoHoja");

-- CreateIndex
CREATE INDEX "ventas_insumo_variantes_equipamiento_factorOficiales_idx" ON "ventas_insumo_variantes"("equipamiento", "factorOficiales");
