import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";

export type FingerShiftRow = {
  id: string;
  name: string;
  company: string | null;
  startTime: string;
  endTime: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  minWorkMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapShift(row: {
  id: string;
  name: string;
  company: string | null;
  startTime: string;
  endTime: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  minWorkMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): FingerShiftRow {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFingerShifts(filters?: { company?: string; activeOnly?: boolean }) {
  const where: Prisma.FingerShiftScheduleWhereInput = {};
  if (filters?.company?.trim()) {
    const code = filters.company.trim().toUpperCase();
    where.OR = [{ company: code }, { company: null, isDefault: true }];
  }
  if (filters?.activeOnly !== false) where.isActive = true;

  const rows = await prisma.fingerShiftSchedule.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(mapShift);
}

export async function getFingerShift(id: string): Promise<FingerShiftRow | null> {
  const row = await prisma.fingerShiftSchedule.findUnique({ where: { id } });
  return row ? mapShift(row) : null;
}

export async function ensureDefaultFingerShift() {
  const existing = await prisma.fingerShiftSchedule.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (existing) return mapShift(existing);

  const row = await prisma.fingerShiftSchedule.create({
    data: {
      id: "default-standard-shift",
      name: "Jornada estándar",
      startTime: "08:00",
      endTime: "17:00",
      lateGraceMinutes: 10,
      earlyLeaveGraceMinutes: 5,
      minWorkMinutes: 420,
      isDefault: true,
    },
  });
  return mapShift(row);
}

export async function createFingerShift(input: {
  name: string;
  startTime: string;
  endTime: string;
  company?: string;
  lateGraceMinutes?: number;
  earlyLeaveGraceMinutes?: number;
  minWorkMinutes?: number;
  isDefault?: boolean;
}) {
  if (input.isDefault) {
    await prisma.fingerShiftSchedule.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const row = await prisma.fingerShiftSchedule.create({
    data: {
      name: input.name.trim(),
      startTime: input.startTime.trim(),
      endTime: input.endTime.trim(),
      company: input.company?.trim().toUpperCase() || null,
      lateGraceMinutes: input.lateGraceMinutes ?? 10,
      earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes ?? 5,
      minWorkMinutes: input.minWorkMinutes ?? 420,
      isDefault: input.isDefault ?? false,
    },
  });
  return mapShift(row);
}

export async function updateFingerShift(
  id: string,
  input: Partial<{
    name: string;
    startTime: string;
    endTime: string;
    company: string;
    lateGraceMinutes: number;
    earlyLeaveGraceMinutes: number;
    minWorkMinutes: number;
    isDefault: boolean;
    isActive: boolean;
  }>,
) {
  if (input.isDefault) {
    await prisma.fingerShiftSchedule.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const row = await prisma.fingerShiftSchedule.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime.trim() } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime.trim() } : {}),
      ...(input.company !== undefined ? { company: input.company.trim().toUpperCase() || null } : {}),
      ...(input.lateGraceMinutes !== undefined ? { lateGraceMinutes: input.lateGraceMinutes } : {}),
      ...(input.earlyLeaveGraceMinutes !== undefined
        ? { earlyLeaveGraceMinutes: input.earlyLeaveGraceMinutes }
        : {}),
      ...(input.minWorkMinutes !== undefined ? { minWorkMinutes: input.minWorkMinutes } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  return mapShift(row);
}

export async function deleteFingerShift(id: string) {
  const used = await prisma.fingerAttendanceDay.count({ where: { shiftId: id } });
  if (used > 0) {
    throw new Error("No se puede eliminar un turno con asistencia calculada. Desactívelo en su lugar.");
  }
  await prisma.fingerShiftSchedule.delete({ where: { id } });
  return { deleted: true, id };
}
