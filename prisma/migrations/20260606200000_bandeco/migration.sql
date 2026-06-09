-- CreateTable
CREATE TABLE "bandeco_alarm_codes" (
    "id" TEXT NOT NULL,
    "alarmNumber" INTEGER NOT NULL,
    "finca" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "motorizado" TEXT NOT NULL,
    "bodycam" TEXT,
    "grupoWsp" TEXT,
    "encargado" TEXT,
    "numeroEncargado" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bandeco_alarm_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_pantallas" (
    "id" TEXT NOT NULL,
    "alarmCodeId" TEXT NOT NULL,
    "finca" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "pantalla" INTEGER,
    "camara" INTEGER,
    "zonaExterna" TEXT,
    "pantalla2" INTEGER,
    "camara2" INTEGER,

    CONSTRAINT "bandeco_pantallas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_puestos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bandeco_puestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_camaras" (
    "id" TEXT NOT NULL,
    "pantallaNum" INTEGER NOT NULL,
    "camaraNum" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "bandeco_camaras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_apertura_cuentas" (
    "id" TEXT NOT NULL,
    "finca" TEXT NOT NULL,
    "cuentaNum" INTEGER NOT NULL,
    "nombreCuenta" TEXT NOT NULL,

    CONSTRAINT "bandeco_apertura_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_pila_fincas" (
    "id" TEXT NOT NULL,
    "finca" TEXT NOT NULL,
    "desmane" TEXT,
    "paneo" TEXT,
    "zonaMotorizado" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "bandeco_pila_fincas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_activaciones" (
    "id" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alarmNumber" INTEGER NOT NULL,
    "alarmCodeId" TEXT,
    "finca" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "motorizado" TEXT,
    "bodycam" TEXT,
    "grupoWsp" TEXT,
    "encargado" TEXT,
    "numeroEncargado" TEXT,
    "operadorName" TEXT NOT NULL,
    "operadorId" TEXT,
    "estado" TEXT,
    "informe" TEXT,
    "mensaje" TEXT,
    "tipoActivacion" TEXT,

    CONSTRAINT "bandeco_activaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_aperturas_cierres" (
    "id" TEXT NOT NULL,
    "finca" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "alarmCodeId" TEXT,
    "ubicacion" TEXT NOT NULL,
    "dia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaApertura" TEXT,
    "horaCierre" TEXT,
    "operadorName" TEXT NOT NULL,
    "estado" TEXT,

    CONSTRAINT "bandeco_aperturas_cierres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandeco_eventos" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT,
    "finca" TEXT NOT NULL,
    "motivo" TEXT,
    "informe" TEXT NOT NULL,
    "operadorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bandeco_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bandeco_alarm_codes_alarmNumber_key" ON "bandeco_alarm_codes"("alarmNumber");

-- CreateIndex
CREATE INDEX "bandeco_alarm_codes_finca_idx" ON "bandeco_alarm_codes"("finca");

-- CreateIndex
CREATE UNIQUE INDEX "bandeco_pantallas_alarmCodeId_key" ON "bandeco_pantallas"("alarmCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "bandeco_puestos_name_key" ON "bandeco_puestos"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bandeco_camaras_pantallaNum_camaraNum_key" ON "bandeco_camaras"("pantallaNum", "camaraNum");

-- CreateIndex
CREATE INDEX "bandeco_apertura_cuentas_finca_idx" ON "bandeco_apertura_cuentas"("finca");

-- CreateIndex
CREATE INDEX "bandeco_apertura_cuentas_cuentaNum_idx" ON "bandeco_apertura_cuentas"("cuentaNum");

-- CreateIndex
CREATE UNIQUE INDEX "bandeco_pila_fincas_finca_key" ON "bandeco_pila_fincas"("finca");

-- CreateIndex
CREATE INDEX "bandeco_activaciones_activatedAt_idx" ON "bandeco_activaciones"("activatedAt");

-- CreateIndex
CREATE INDEX "bandeco_activaciones_alarmNumber_idx" ON "bandeco_activaciones"("alarmNumber");

-- CreateIndex
CREATE INDEX "bandeco_aperturas_cierres_fecha_idx" ON "bandeco_aperturas_cierres"("fecha");

-- CreateIndex
CREATE INDEX "bandeco_aperturas_cierres_codigo_idx" ON "bandeco_aperturas_cierres"("codigo");

-- CreateIndex
CREATE INDEX "bandeco_eventos_fecha_idx" ON "bandeco_eventos"("fecha");

-- AddForeignKey
ALTER TABLE "bandeco_pantallas" ADD CONSTRAINT "bandeco_pantallas_alarmCodeId_fkey" FOREIGN KEY ("alarmCodeId") REFERENCES "bandeco_alarm_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bandeco_activaciones" ADD CONSTRAINT "bandeco_activaciones_alarmCodeId_fkey" FOREIGN KEY ("alarmCodeId") REFERENCES "bandeco_alarm_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bandeco_aperturas_cierres" ADD CONSTRAINT "bandeco_aperturas_cierres_alarmCodeId_fkey" FOREIGN KEY ("alarmCodeId") REFERENCES "bandeco_alarm_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
