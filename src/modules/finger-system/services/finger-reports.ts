import { prisma } from "@/modules/core/db/prisma";
import type { FingerAttendanceStatus } from "@prisma/client";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type FingerAttendanceReportSummary = {
  from: string;
  to: string;
  company: string | null;
  totals: Record<FingerAttendanceStatus, number>;
  totalRecords: number;
  linkedEmployees: number;
  byDate: {
    date: string;
    present: number;
    absent: number;
    late: number;
    incomplete: number;
    earlyLeave: number;
  }[];
};

function companyWhere(company?: string | null): { employee: { company: string } } | undefined {
  const code = company?.trim().toUpperCase();
  if (!code) return undefined;
  return { employee: { company: code } };
}

export async function buildFingerAttendanceReport(
  fromInput: Date,
  toInput: Date,
  company?: string | null,
): Promise<FingerAttendanceReportSummary> {
  const from = startOfDay(fromInput);
  const to = startOfDay(toInput);
  if (from > to) throw new Error("La fecha inicial no puede ser posterior a la final.");

  const companyFilter = companyWhere(company);

  const rows = await prisma.fingerAttendanceDay.findMany({
    where: {
      workDate: { gte: from, lte: to },
      ...(companyFilter ?? {}),
    },
    select: { workDate: true, status: true },
    orderBy: { workDate: "asc" },
  });

  const totals: Record<FingerAttendanceStatus, number> = {
    PRESENT: 0,
    ABSENT: 0,
    INCOMPLETE: 0,
    LATE: 0,
    EARLY_LEAVE: 0,
  };

  const byDateMap = new Map<string, FingerAttendanceReportSummary["byDate"][0]>();

  for (const row of rows) {
    totals[row.status]++;
    const date = row.workDate.toISOString().slice(0, 10);
    const bucket = byDateMap.get(date) ?? {
      date,
      present: 0,
      absent: 0,
      late: 0,
      incomplete: 0,
      earlyLeave: 0,
    };
    if (row.status === "PRESENT") bucket.present++;
    else if (row.status === "ABSENT") bucket.absent++;
    else if (row.status === "LATE") bucket.late++;
    else if (row.status === "INCOMPLETE") bucket.incomplete++;
    else if (row.status === "EARLY_LEAVE") bucket.earlyLeave++;
    byDateMap.set(date, bucket);
  }

  const linkedEmployees = await prisma.fingerEmployeeLink.count({
    where: company?.trim()
      ? {
          OR: [
            { company: company.trim().toUpperCase() },
            { employee: { company: company.trim().toUpperCase() } },
          ],
        }
      : undefined,
  });

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    company: company?.trim().toUpperCase() ?? null,
    totals,
    totalRecords: rows.length,
    linkedEmployees,
    byDate: [...byDateMap.values()],
  };
}

export type FingerAttendanceExportRow = {
  workDate: string;
  employeeCodigo: string;
  employeeName: string | null;
  status: string;
  firstIn: string;
  lastOut: string;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  punchCount: number;
  shiftName: string | null;
};

export async function listFingerAttendanceExportRows(
  fromInput: Date,
  toInput: Date,
  company?: string | null,
): Promise<FingerAttendanceExportRow[]> {
  const from = startOfDay(fromInput);
  const to = startOfDay(toInput);
  const companyFilter = companyWhere(company);

  const rows = await prisma.fingerAttendanceDay.findMany({
    where: {
      workDate: { gte: from, lte: to },
      ...(companyFilter ?? {}),
    },
    orderBy: [{ workDate: "asc" }, { employee: { nombre: "asc" } }],
    select: {
      workDate: true,
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
  });

  return rows.map((r) => ({
    workDate: r.workDate.toISOString().slice(0, 10),
    employeeCodigo: r.employee.codigoEmpleado,
    employeeName: r.employee.nombre,
    status: r.status,
    firstIn: r.firstIn ? r.firstIn.toISOString() : "",
    lastOut: r.lastOut ? r.lastOut.toISOString() : "",
    workedMinutes: r.workedMinutes,
    lateMinutes: r.lateMinutes,
    earlyLeaveMinutes: r.earlyLeaveMinutes,
    punchCount: r.punchCount,
    shiftName: r.shift?.name ?? null,
  }));
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function fingerAttendanceReportToCsv(rows: FingerAttendanceExportRow[]): string {
  const header = [
    "Fecha",
    "CodigoEmpleado",
    "Nombre",
    "Estado",
    "Entrada",
    "Salida",
    "MinutosTrabajados",
    "MinutosTarde",
    "MinutosSalidaAnticipada",
    "CantidadMarcas",
    "Turno",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.workDate),
        csvEscape(r.employeeCodigo),
        csvEscape(r.employeeName ?? ""),
        csvEscape(r.status),
        csvEscape(r.firstIn),
        csvEscape(r.lastOut),
        csvEscape(r.workedMinutes),
        csvEscape(r.lateMinutes),
        csvEscape(r.earlyLeaveMinutes),
        csvEscape(r.punchCount),
        csvEscape(r.shiftName),
      ].join(","),
    );
  }
  return "\uFEFF" + lines.join("\n");
}

export async function exportFingerAttendanceCsv(
  fromInput: Date,
  toInput: Date,
  company?: string | null,
): Promise<{ filename: string; body: string }> {
  const rows = await listFingerAttendanceExportRows(fromInput, toInput, company);
  const from = startOfDay(fromInput).toISOString().slice(0, 10);
  const to = startOfDay(toInput).toISOString().slice(0, 10);
  const suffix = company?.trim() ? `_${company.trim().toUpperCase()}` : "";
  return {
    filename: `finger-asistencia_${from}_${to}${suffix}.csv`,
    body: fingerAttendanceReportToCsv(rows),
  };
}
