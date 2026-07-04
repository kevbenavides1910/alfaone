-- CreateEnum
CREATE TYPE "VentasOportunidadEstado" AS ENUM ('PENDIENTE_DECIDIR', 'PARTICIPAR', 'NO_PARTICIPAR');

-- CreateTable
CREATE TABLE "ventas_oportunidades" (
    "id" TEXT NOT NULL,
    "licitacionNo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaPresentacion" TIMESTAMP(3) NOT NULL,
    "enlace" TEXT,
    "estado" "VentasOportunidadEstado" NOT NULL DEFAULT 'PENDIENTE_DECIDIR',
    "source" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_oportunidades_licitacionNo_key" ON "ventas_oportunidades"("licitacionNo");

-- CreateIndex
CREATE INDEX "ventas_oportunidades_estado_idx" ON "ventas_oportunidades"("estado");

-- CreateIndex
CREATE INDEX "ventas_oportunidades_fechaPresentacion_idx" ON "ventas_oportunidades"("fechaPresentacion");

-- CreateIndex
CREATE INDEX "ventas_oportunidades_cliente_idx" ON "ventas_oportunidades"("cliente");

-- AddForeignKey
ALTER TABLE "ventas_oportunidades" ADD CONSTRAINT "ventas_oportunidades_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
