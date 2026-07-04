import "server-only";
import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/modules/core/db/prisma";
import { ticketsVisibilityWhere } from "./ticket-access";
import { statusCodesForExportGroups, type TicketExportStatusGroupKey } from "../business/report-status-groups";
import type { TicketReportExportInput } from "../validations/report-export.schema";

function parseDayStart(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function parseDayEnd(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

function fmtDate(v: Date | null | undefined): string {
  if (!v) return "";
  const dd = String(v.getUTCDate()).padStart(2, "0");
  const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${v.getUTCFullYear()}`;
}

export async function queryTicketsForExport(
  session: Session,
  userId: string,
  input: TicketReportExportInput
) {
  if (input.dateFrom > input.dateTo) {
    throw new Error("La fecha inicial no puede ser posterior a la final");
  }

  const statusCodes = statusCodesForExportGroups(input.statusGroups as TicketExportStatusGroupKey[]);
  const where: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...ticketsVisibilityWhere(session, userId),
    openedAt: {
      gte: parseDayStart(input.dateFrom),
      lte: parseDayEnd(input.dateTo),
    },
    status: { code: { in: statusCodes } },
  };

  if (input.personId) {
    if (input.filterType === "technician") {
      where.assignedToId = input.personId;
    } else {
      where.requesterId = input.personId;
    }
  }

  return prisma.ticket.findMany({
    where,
    include: {
      category: true,
      priority: true,
      status: true,
      type: true,
      department: true,
      requester: { select: { name: true, email: true } },
      assignedTo: { select: { name: true, email: true } },
    },
    orderBy: [{ openedAt: "desc" }, { ticketNumber: "desc" }],
    take: 10_000,
  });
}

export function buildTicketsExportWorkbook(
  rows: Awaited<ReturnType<typeof queryTicketsForExport>>
): Buffer {
  const data = rows.map((t) => ({
    "Número": t.ticketNumber,
    "Título": t.title,
    "Estado": t.status.name,
    "Prioridad": t.priority.name,
    "Categoría": t.category.name,
    "Tipo": t.type.name,
    "Departamento": t.department?.name ?? "",
    "Solicitante": t.requester.name,
    "Email solicitante": t.requester.email,
    "Técnico": t.assignedTo?.name ?? "",
    "Email técnico": t.assignedTo?.email ?? "",
    "Fecha apertura": fmtDate(t.openedAt),
    "Fecha asignación": fmtDate(t.assignedAt),
    "Fecha resolución": fmtDate(t.resolvedAt),
    "Fecha cierre": fmtDate(t.closedAt),
    "Minutos trabajo": t.totalWorkMinutes,
    "Detalle categoría": t.categoryDetail ?? "",
    "Descripción": t.description.slice(0, 2000),
  }));

  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Mensaje: "Sin registros para los filtros seleccionados" }]);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 36 },
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 26 },
    { wch: 22 },
    { wch: 26 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 48 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tickets");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
