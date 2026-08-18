-- CreateEnum
CREATE TYPE "FingerAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'INCOMPLETE', 'LATE', 'EARLY_LEAVE');

-- CreateTable
CREATE TABLE "finger_shift_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 10,
    "earlyLeaveGraceMinutes" INTEGER NOT NULL DEFAULT 5,
    "minWorkMinutes" INTEGER NOT NULL DEFAULT 420,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finger_shift_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finger_attendance_days" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "shiftId" TEXT,
    "firstIn" TIMESTAMP(3),
    "lastOut" TIMESTAMP(3),
    "workedMinutes" INTEGER,
    "status" "FingerAttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "punchCount" INTEGER NOT NULL DEFAULT 0,
    "detailJson" JSONB,
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finger_attendance_days_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finger_shift_schedules_company_idx" ON "finger_shift_schedules"("company");
CREATE INDEX "finger_shift_schedules_isDefault_idx" ON "finger_shift_schedules"("isDefault");

CREATE UNIQUE INDEX "finger_attendance_days_employeeId_workDate_key" ON "finger_attendance_days"("employeeId", "workDate");
CREATE INDEX "finger_attendance_days_workDate_idx" ON "finger_attendance_days"("workDate" DESC);
CREATE INDEX "finger_attendance_days_status_idx" ON "finger_attendance_days"("status");
CREATE INDEX "finger_attendance_days_shiftId_idx" ON "finger_attendance_days"("shiftId");

ALTER TABLE "finger_shift_schedules" ADD CONSTRAINT "finger_shift_schedules_company_fkey" FOREIGN KEY ("company") REFERENCES "companies"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finger_attendance_days" ADD CONSTRAINT "finger_attendance_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finger_attendance_days" ADD CONSTRAINT "finger_attendance_days_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "finger_shift_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Turno estándar (08:00–17:00, tolerancias ATTPARAM)
INSERT INTO "finger_shift_schedules" (
    "id", "name", "startTime", "endTime",
    "lateGraceMinutes", "earlyLeaveGraceMinutes", "minWorkMinutes",
    "isDefault", "isActive", "updatedAt"
) VALUES (
    'default-standard-shift',
    'Jornada estándar',
    '08:00',
    '17:00',
    10,
    5,
    420,
    true,
    true,
    CURRENT_TIMESTAMP
);
