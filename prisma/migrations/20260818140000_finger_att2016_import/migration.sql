-- CreateTable
CREATE TABLE "finger_import_batches" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsInserted" INTEGER NOT NULL DEFAULT 0,
    "rowsUpdated" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" JSONB,
    "detailJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "triggeredById" TEXT,

    CONSTRAINT "finger_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finger_punches" (
    "id" TEXT NOT NULL,
    "attUserId" INTEGER NOT NULL,
    "badgeNumber" TEXT,
    "checkTime" TIMESTAMP(3) NOT NULL,
    "checkType" TEXT,
    "verifyCode" INTEGER,
    "sensorId" TEXT,
    "workCode" INTEGER,
    "deviceSn" TEXT,
    "employeeId" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finger_punches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finger_import_batches_type_startedAt_idx" ON "finger_import_batches"("type", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "finger_punches_attUserId_checkTime_key" ON "finger_punches"("attUserId", "checkTime");

-- CreateIndex
CREATE INDEX "finger_punches_checkTime_idx" ON "finger_punches"("checkTime" DESC);

-- CreateIndex
CREATE INDEX "finger_punches_employeeId_idx" ON "finger_punches"("employeeId");

-- CreateIndex
CREATE INDEX "finger_punches_badgeNumber_idx" ON "finger_punches"("badgeNumber");

-- CreateIndex
CREATE INDEX "finger_punches_importBatchId_idx" ON "finger_punches"("importBatchId");

-- AddForeignKey
ALTER TABLE "finger_import_batches" ADD CONSTRAINT "finger_import_batches_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finger_punches" ADD CONSTRAINT "finger_punches_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finger_punches" ADD CONSTRAINT "finger_punches_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "finger_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
