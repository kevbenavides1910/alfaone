import { prisma } from "@/modules/core/db/prisma";
import type { FingerAttendanceStatus, Prisma } from "@prisma/client";
import { ensureDefaultFingerShift } from "@/modules/finger-system/services/finger-shifts";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayExclusive(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

function eachDayInclusive(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function parseTimeOnDate(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((v) => Number.parseInt(v, 10));
  const d = startOfDay(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}

type CalcResult = {
  status: FingerAttendanceStatus;
  firstIn: Date | null;
  lastOut: Date | null;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  punchCount: number;
};

function calculateDayFromPunches(
  punches: Date[],
  day: Date,
  shift: {
    startTime: string;
    endTime: string;
    lateGraceMinutes: number;
    earlyLeaveGraceMinutes: number;
    minWorkMinutes: number;
  },
): CalcResult {
  if (punches.length === 0) {
    return {
      status: "ABSENT",
      firstIn: null,
      lastOut: null,
      workedMinutes: null,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      punchCount: 0,
    };
  }

  const sorted = [...punches].sort((a, b) => a.getTime() - b.getTime());
  const firstIn = sorted[0]!;
  const lastOut = sorted.length > 1 ? sorted[sorted.length - 1]! : null;
  const punchCount = sorted.length;

  if (!lastOut || lastOut.getTime() <= firstIn.getTime()) {
    return {
      status: "INCOMPLETE",
      firstIn,
      lastOut: lastOut ?? null,
      workedMinutes: lastOut ? minutesBetween(firstIn, lastOut) : 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      punchCount,
    };
  }

  const scheduledStart = parseTimeOnDate(day, shift.startTime);
  const scheduledEnd = parseTimeOnDate(day, shift.endTime);
  const workedMinutes = minutesBetween(firstIn, lastOut);

  const lateMinutes = Math.max(
    0,
    minutesBetween(scheduledStart, firstIn) - shift.lateGraceMinutes,
  );
  const earlyLeaveMinutes = Math.max(
    0,
    minutesBetween(lastOut, scheduledEnd) - shift.earlyLeaveGraceMinutes,
  );

  let status: FingerAttendanceStatus = "PRESENT";
  if (lateMinutes > 0) status = "LATE";
  else if (earlyLeaveMinutes > 0) status = "EARLY_LEAVE";
  else if (workedMinutes < shift.minWorkMinutes) status = "INCOMPLETE";

  return {
    status,
    firstIn,
    lastOut,
    workedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    punchCount,
  };
}

export async function calculateFingerAttendance(params: {
  from: Date;
  to: Date;
  userId: string;
  company?: string | null;
  ipAddress?: string | null;
}) {
  const from = startOfDay(params.from);
  const to = startOfDay(params.to);
  if (from > to) throw new Error("La fecha inicial no puede ser posterior a la final.");

  const days = eachDayInclusive(from, to);
  const shift = await ensureDefaultFingerShift();
  const shiftRow = await prisma.fingerShiftSchedule.findUniqueOrThrow({ where: { id: shift.id } });

  const companyCode = params.company?.trim().toUpperCase();
  const links = await prisma.fingerEmployeeLink.findMany({
    where: companyCode
      ? {
          OR: [{ company: companyCode }, { employee: { company: companyCode } }],
        }
      : undefined,
    select: { employeeId: true },
  });
  const employeeIds = [...new Set(links.map((l) => l.employeeId))];

  const rangeEnd = endOfDayExclusive(to);
  const punches = await prisma.fingerPunch.findMany({
    where: {
      checkTime: { gte: from, lt: rangeEnd },
      employeeId: { in: employeeIds },
    },
    select: { employeeId: true, checkTime: true },
    orderBy: { checkTime: "asc" },
  });

  const punchesByEmpDay = new Map<string, Date[]>();
  for (const p of punches) {
    if (!p.employeeId) continue;
    const dayKey = startOfDay(p.checkTime).toISOString().slice(0, 10);
    const key = `${p.employeeId}|${dayKey}`;
    const list = punchesByEmpDay.get(key) ?? [];
    list.push(p.checkTime);
    punchesByEmpDay.set(key, list);
  }

  let rowsUpserted = 0;
  const now = new Date();

  for (const employeeId of employeeIds) {
    for (const day of days) {
      const dayKey = day.toISOString().slice(0, 10);
      const punchTimes = punchesByEmpDay.get(`${employeeId}|${dayKey}`) ?? [];
      const calc = calculateDayFromPunches(punchTimes, day, shiftRow);

      await prisma.fingerAttendanceDay.upsert({
        where: {
          employeeId_workDate: { employeeId, workDate: day },
        },
        create: {
          employeeId,
          workDate: day,
          shiftId: shiftRow.id,
          firstIn: calc.firstIn,
          lastOut: calc.lastOut,
          workedMinutes: calc.workedMinutes,
          status: calc.status,
          lateMinutes: calc.lateMinutes,
          earlyLeaveMinutes: calc.earlyLeaveMinutes,
          punchCount: calc.punchCount,
          calculatedAt: now,
          detailJson: { shiftName: shiftRow.name },
        },
        update: {
          shiftId: shiftRow.id,
          firstIn: calc.firstIn,
          lastOut: calc.lastOut,
          workedMinutes: calc.workedMinutes,
          status: calc.status,
          lateMinutes: calc.lateMinutes,
          earlyLeaveMinutes: calc.earlyLeaveMinutes,
          punchCount: calc.punchCount,
          calculatedAt: now,
          detailJson: { shiftName: shiftRow.name },
        },
      });
      rowsUpserted++;
    }
  }

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PULL",
      status: "SUCCESS",
      operation: "attendance_calculate",
      message: `Calculados ${rowsUpserted} registros diarios (${from.toISOString().slice(0, 10)} a ${to.toISOString().slice(0, 10)}).`,
      triggeredById: params.userId,
      finishedAt: now,
      detailJson: { rowsUpserted, employeeCount: employeeIds.length, dayCount: days.length },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.attendance.calculate",
    ipAddress: params.ipAddress ?? null,
    metadata: {
      rowsUpserted,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      company: companyCode ?? null,
    },
  });

  return {
    rowsUpserted,
    employeeCount: employeeIds.length,
    dayCount: days.length,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    company: companyCode ?? null,
  };
}

export type FingerAttendanceDayRow = {
  id: string;
  workDate: string;
  employeeId: string;
  employeeName: string | null;
  employeeCodigo: string;
  status: FingerAttendanceStatus;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  punchCount: number;
  shiftName: string | null;
};

export async function listFingerAttendanceDays(filters: {
  from: Date;
  to: Date;
  q?: string;
  company?: string;
  status?: FingerAttendanceStatus;
  page?: number;
  pageSize?: number;
}) {
  const from = startOfDay(filters.from);
  const to = startOfDay(filters.to);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.FingerAttendanceDayWhereInput = {
    workDate: { gte: from, lte: to },
  };

  if (filters.status) where.status = filters.status;

  const employeeWhere: Prisma.EmployeeWhereInput = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    employeeWhere.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { codigoEmpleado: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.company?.trim()) {
    employeeWhere.company = filters.company.trim().toUpperCase();
  }

  if (Object.keys(employeeWhere).length > 0) {
    where.employee = employeeWhere;
  }

  const [total, rows] = await Promise.all([
    prisma.fingerAttendanceDay.count({ where }),
    prisma.fingerAttendanceDay.findMany({
      where,
      orderBy: [{ workDate: "desc" }, { employee: { nombre: "asc" } }],
      skip,
      take: pageSize,
      select: {
        id: true,
        workDate: true,
        employeeId: true,
        status: true,
        firstIn: true,
        lastOut: true,
        workedMinutes: true,
        lateMinutes: true,
        earlyLeaveMinutes: true,
        punchCount: true,
        shift: { select: { name: true } },
        employee: { select: { nombre: true, codigoEmpleado: true } },
      },
    }),
  ]);

  const items: FingerAttendanceDayRow[] = rows.map((r) => ({
    id: r.id,
    workDate: r.workDate.toISOString().slice(0, 10),
    employeeId: r.employeeId,
    employeeName: r.employee.nombre,
    employeeCodigo: r.employee.codigoEmpleado,
    status: r.status,
    firstIn: r.firstIn?.toISOString() ?? null,
    lastOut: r.lastOut?.toISOString() ?? null,
    workedMinutes: r.workedMinutes,
    lateMinutes: r.lateMinutes,
    earlyLeaveMinutes: r.earlyLeaveMinutes,
    punchCount: r.punchCount,
    shiftName: r.shift?.name ?? null,
  }));

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getFingerAttendanceSummaryForDate(date: Date) {
  const day = startOfDay(date);
  const [present, late, incomplete, absent, earlyLeave] = await Promise.all([
    prisma.fingerAttendanceDay.count({ where: { workDate: day, status: "PRESENT" } }),
    prisma.fingerAttendanceDay.count({ where: { workDate: day, status: "LATE" } }),
    prisma.fingerAttendanceDay.count({ where: { workDate: day, status: "INCOMPLETE" } }),
    prisma.fingerAttendanceDay.count({ where: { workDate: day, status: "ABSENT" } }),
    prisma.fingerAttendanceDay.count({ where: { workDate: day, status: "EARLY_LEAVE" } }),
  ]);

  return {
    present,
    late,
    incomplete,
    absent,
    earlyLeave,
    employeesPresentToday: present + late + earlyLeave,
    employeesAbsentToday: absent,
    lateArrivalsToday: late,
  };
}
