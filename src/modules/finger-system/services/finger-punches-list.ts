import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

export type FingerPunchListRow = {
  id: string;
  checkTime: string;
  attUserId: number;
  badgeNumber: string | null;
  checkType: string | null;
  verifyCode: number | null;
  source: string;
  deviceId: string | null;
  deviceName: string | null;
  deviceSn: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeCodigo: string | null;
};

export type FingerPunchListInput = {
  page?: number;
  pageSize?: number;
  q?: string;
  employeeId?: string;
  deviceId?: string;
  badgeNumber?: string;
  source?: "DEVICE" | "ATT2016";
  from?: string;
  to?: string;
  company?: string;
};

export async function listFingerPunches(input: FingerPunchListInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 25));

  const where: Prisma.FingerPunchWhereInput = {};

  if (input.employeeId) where.employeeId = input.employeeId;
  if (input.deviceId) where.deviceId = input.deviceId;
  if (input.badgeNumber?.trim()) {
    where.badgeNumber = { contains: input.badgeNumber.trim(), mode: "insensitive" };
  }
  if (input.source) where.source = input.source;

  if (input.from || input.to) {
    where.checkTime = {};
    if (input.from) where.checkTime.gte = new Date(`${input.from}T00:00:00`);
    if (input.to) where.checkTime.lte = new Date(`${input.to}T23:59:59.999`);
  }

  if (input.company?.trim()) {
    where.employee = { company: input.company.trim().toUpperCase() };
  }

  if (input.q?.trim()) {
    const q = input.q.trim();
    const or: Prisma.FingerPunchWhereInput[] = [
      { badgeNumber: { contains: q, mode: "insensitive" } },
      { deviceSn: { contains: q, mode: "insensitive" } },
      { employee: { nombre: { contains: q, mode: "insensitive" } } },
      { employee: { codigoEmpleado: { contains: q, mode: "insensitive" } } },
    ];
    const asNum = Number.parseInt(q, 10);
    if (Number.isFinite(asNum)) or.push({ attUserId: asNum });
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: or }];
  }

  const [total, rows] = await Promise.all([
    prisma.fingerPunch.count({ where }),
    prisma.fingerPunch.findMany({
      where,
      orderBy: { checkTime: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { id: true, nombre: true, codigoEmpleado: true } },
        device: { select: { id: true, name: true } },
      },
    }),
  ]);

  const mapped: FingerPunchListRow[] = rows.map((r) => ({
    id: r.id,
    checkTime: r.checkTime.toISOString(),
    attUserId: r.attUserId,
    badgeNumber: r.badgeNumber,
    checkType: r.checkType,
    verifyCode: r.verifyCode,
    source: r.source,
    deviceId: r.deviceId,
    deviceName: r.device?.name ?? null,
    deviceSn: r.deviceSn,
    employeeId: r.employeeId,
    employeeName: r.employee?.nombre ?? null,
    employeeCodigo: r.employee?.codigoEmpleado ?? null,
  }));

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    rows: mapped,
  };
}
