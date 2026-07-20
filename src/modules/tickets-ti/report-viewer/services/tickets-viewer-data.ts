import "server-only";
import type { Session } from "next-auth";
import { prisma } from "@/modules/core/db/prisma";
import { ticketsVisibilityWhere } from "@/modules/tickets-ti/services/ticket-access";
import { statusCodesForExportGroups, type TicketExportStatusGroupKey } from "@/modules/tickets-ti/business/report-status-groups";
import type { TicketReportExportInput } from "@/modules/tickets-ti/validations/report-export.schema";

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

export async function queryTicketsForViewer(
  session: Session,
  userId: string,
  input: TicketReportExportInput
) {
  if (input.dateFrom > input.dateTo) {
    throw new Error("La fecha inicial no puede ser posterior a la final");
  }

  const statusCodes = statusCodesForExportGroups(input.statusGroups as TicketExportStatusGroupKey[]);
  const where = {
    deletedAt: null,
    ...ticketsVisibilityWhere(session, userId),
    openedAt: {
      gte: parseDayStart(input.dateFrom),
      lte: parseDayEnd(input.dateTo),
    },
    status: { code: { in: statusCodes } },
    ...(input.personId
      ? input.filterType === "technician"
        ? { assignedToId: input.personId }
        : { requesterId: input.personId }
      : {}),
  };

  return prisma.ticket.findMany({
    where,
    include: {
      category: true,
      priority: true,
      status: true,
      type: true,
      requester: { select: { name: true, email: true, company: true } },
      assignedTo: { select: { name: true, email: true } },
      slas: { orderBy: { createdAt: "desc" as const }, take: 1 },
    },
    orderBy: [{ openedAt: "desc" }, { ticketNumber: "desc" }],
    take: 100_000,
  });
}

export function ticketsToViewerRows(
  rows: Awaited<ReturnType<typeof queryTicketsForViewer>>
): Record<string, unknown>[] {
  return rows.map((t) => {
    const sla = t.slas[0];
    return {
      Número: t.ticketNumber,
      Título: t.title,
      Estado: t.status.name,
      Prioridad: t.priority.name,
      Severidad: t.priority.name,
      Categoría: t.category.name,
      Tipo: t.type.name,
      Cliente: t.requester.company ?? t.requester.name,
      Solicitante: t.requester.name,
      "Email solicitante": t.requester.email,
      Técnico: t.assignedTo?.name ?? "",
      "Email técnico": t.assignedTo?.email ?? "",
      "Fecha apertura": fmtDate(t.openedAt),
      "Fecha asignación": fmtDate(t.assignedAt),
      "Fecha resolución": fmtDate(t.resolvedAt),
      "Fecha cierre": fmtDate(t.closedAt),
      "Minutos trabajo": t.totalWorkMinutes,
      SLA: sla?.status ?? "",
      "Minutos SLA restantes": sla?.remainingMinutes ?? "",
      "Detalle categoría": t.categoryDetail ?? "",
      Descripción: t.description.slice(0, 500),
    };
  });
}
