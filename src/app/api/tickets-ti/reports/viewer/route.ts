import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { ticketReportExportSchema } from "@/modules/tickets-ti/validations/report-export.schema";
import {
  queryTicketsForViewer,
  ticketsToViewerRows,
} from "@/modules/tickets-ti/report-viewer/services/tickets-viewer-data";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view")) return forbidden();

  const parsed = ticketReportExportSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    const rows = await queryTicketsForViewer(session, session.user.id, parsed.data);
    const warnings: string[] = [];
    if (rows.length >= 100_000) {
      warnings.push("Se alcanzó el límite de 100.000 registros; refine el rango de fechas.");
    }
    if (rows.length === 0) {
      warnings.push("No hay tickets para el rango y filtros seleccionados.");
    }
    return ok({ rows: ticketsToViewerRows(rows), warnings, total: rows.length });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al consultar historial");
  }
}
