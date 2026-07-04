-- CreateEnum
CREATE TYPE "VentasSalarioTipo" AS ENUM ('MENSUAL', 'HORARIO');
CREATE TYPE "VentasEquipamiento" AS ENUM ('AF', 'ANL', 'SA', 'L');
CREATE TYPE "VentasJornadaCodigo" AS ENUM ('MO1', 'MO2', 'MO3', 'MO4', 'MO5');
CREATE TYPE "VentasPresupuestoEstado" AS ENUM ('BORRADOR', 'EN_REVISION', 'FINALIZADO');

-- CreateTable
CREATE TABLE "ventas_salario_categorias" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "VentasSalarioTipo" NOT NULL,
    "siglas" TEXT,
    "valoresPorAnio" JSONB NOT NULL,
    "aumentosPct" JSONB,
    "adicionales" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_salario_categorias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_jornada_tipos" (
    "id" TEXT NOT NULL,
    "codigo" "VentasJornadaCodigo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "horasConfig" JSONB NOT NULL,
    "salarioCategoriaCodigo" TEXT,
    "costoHoraOrdinaria" DECIMAL(14,4),
    "costoHoraExtra" DECIMAL(14,4),
    "salarioBaseMensual" DECIMAL(15,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_jornada_tipos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_cargas_sociales" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL(8,4) NOT NULL,
    "grupo" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_cargas_sociales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_pagos_extras" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(15,4) NOT NULL,
    "descripcion" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_pagos_extras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_insumo_items" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "equipamientos" "VentasEquipamiento"[],
    "costoUnitario" DECIMAL(15,2) NOT NULL,
    "depreciacionMeses" INTEGER NOT NULL DEFAULT 12,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_insumo_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_gastos_admin" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoMensual" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_gastos_admin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_indices_actualizacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" DECIMAL(12,6),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ventas_indices_actualizacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_presupuestos" (
    "id" TEXT NOT NULL,
    "oportunidadId" TEXT,
    "licitacionNo" TEXT NOT NULL,
    "compania" TEXT NOT NULL,
    "nombre" TEXT,
    "anioBase" INTEGER NOT NULL DEFAULT 2026,
    "polizaInsPct" DECIMAL(8,4) NOT NULL DEFAULT 5.75,
    "ivaPct" DECIMAL(8,4) NOT NULL DEFAULT 13,
    "margenUtilidadPct" DECIMAL(8,4) NOT NULL DEFAULT 7,
    "imprevistosPct" DECIMAL(8,4) NOT NULL DEFAULT 0.01,
    "estado" "VentasPresupuestoEstado" NOT NULL DEFAULT 'BORRADOR',
    "totalMensual" DECIMAL(15,2),
    "totalAnual" DECIMAL(15,2),
    "totalConIva" DECIMAL(15,2),
    "estructuraResumen" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_presupuestos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_presupuesto_lineas" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "numeroLinea" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "jornadaCodigo" "VentasJornadaCodigo" NOT NULL,
    "equipamiento" "VentasEquipamiento" NOT NULL,
    "cantidadPuestos" INTEGER NOT NULL,
    "factorOficiales" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "costoMo" DECIMAL(15,2),
    "costoGa" DECIMAL(15,2),
    "costoInDirecto" DECIMAL(15,2),
    "costoInIndirecto" DECIMAL(15,2),
    "imprevistos" DECIMAL(15,2),
    "margenUtilidad" DECIMAL(15,2),
    "precioMensual" DECIMAL(15,2),
    "precioAnual" DECIMAL(15,2),
    "precioConIva" DECIMAL(15,2),
    "desglose" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_presupuesto_lineas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ventas_presupuesto_tolerancia" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "ofertaPropia" DECIMAL(15,2),
    "ofertaCompetencia" DECIMAL(15,2),
    "ofertaCliente" DECIMAL(15,2),
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ventas_presupuesto_tolerancia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_salario_categorias_codigo_key" ON "ventas_salario_categorias"("codigo");
CREATE UNIQUE INDEX "ventas_jornada_tipos_codigo_key" ON "ventas_jornada_tipos"("codigo");
CREATE UNIQUE INDEX "ventas_cargas_sociales_codigo_key" ON "ventas_cargas_sociales"("codigo");
CREATE UNIQUE INDEX "ventas_pagos_extras_codigo_key" ON "ventas_pagos_extras"("codigo");
CREATE UNIQUE INDEX "ventas_insumo_items_codigo_key" ON "ventas_insumo_items"("codigo");
CREATE UNIQUE INDEX "ventas_gastos_admin_codigo_key" ON "ventas_gastos_admin"("codigo");
CREATE UNIQUE INDEX "ventas_indices_actualizacion_codigo_key" ON "ventas_indices_actualizacion"("codigo");
CREATE UNIQUE INDEX "ventas_presupuestos_oportunidadId_key" ON "ventas_presupuestos"("oportunidadId");
CREATE INDEX "ventas_presupuestos_licitacionNo_idx" ON "ventas_presupuestos"("licitacionNo");
CREATE INDEX "ventas_presupuestos_estado_idx" ON "ventas_presupuestos"("estado");
CREATE INDEX "ventas_presupuesto_lineas_presupuestoId_idx" ON "ventas_presupuesto_lineas"("presupuestoId");
CREATE UNIQUE INDEX "ventas_presupuesto_tolerancia_presupuestoId_key" ON "ventas_presupuesto_tolerancia"("presupuestoId");

-- AddForeignKey
ALTER TABLE "ventas_presupuestos" ADD CONSTRAINT "ventas_presupuestos_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "ventas_oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ventas_presupuestos" ADD CONSTRAINT "ventas_presupuestos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ventas_presupuesto_lineas" ADD CONSTRAINT "ventas_presupuesto_lineas_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "ventas_presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventas_presupuesto_tolerancia" ADD CONSTRAINT "ventas_presupuesto_tolerancia_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "ventas_presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
