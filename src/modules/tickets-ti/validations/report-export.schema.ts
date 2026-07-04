import { z } from "zod";
import { TICKET_EXPORT_STATUS_GROUPS, type TicketExportStatusGroupKey } from "../business/report-status-groups";

const groupKeys = Object.keys(TICKET_EXPORT_STATUS_GROUPS) as TicketExportStatusGroupKey[];

function parseStatusGroups(raw: string): TicketExportStatusGroupKey[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const valid = parts.filter((p): p is TicketExportStatusGroupKey =>
    groupKeys.includes(p as TicketExportStatusGroupKey)
  );
  if (valid.length === 0) throw new Error("Seleccione al menos un estado válido");
  return valid;
}

export const ticketReportExportSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inicial inválida"),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha final inválida"),
  filterType: z.enum(["technician", "user"]),
  personId: z.string().trim().optional(),
  statusGroups: z.string().min(1).transform(parseStatusGroups),
});

export type TicketReportExportInput = z.infer<typeof ticketReportExportSchema>;
