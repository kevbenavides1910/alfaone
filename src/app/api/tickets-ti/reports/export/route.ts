import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { ticketReportExportSchema } from "@/modules/tickets-ti/validations/report-export.schema";
import { buildTicketsExportWorkbook, queryTicketsForExport } from "@/modules/tickets-ti/services/tickets-export";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view")) return forbidden();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = ticketReportExportSchema.safeParse(params);
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    const rows = await queryTicketsForExport(session, session.user.id, parsed.data);
    const buffer = buildTicketsExportWorkbook(rows);
    const fname = `tickets_${parsed.data.dateFrom}_${parsed.data.dateTo}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return serverError("Error al generar reporte", e);
  }
}
