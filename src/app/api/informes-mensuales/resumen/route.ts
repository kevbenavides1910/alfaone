import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import { MonthlyReportError } from "@/modules/informes-mensuales/services/reports";
import { buildIncidentSummary } from "@/modules/informes-mensuales/services/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withPermission(async (req: NextRequest) => {
  try {
    const reportId = req.nextUrl.searchParams.get("reportId")?.trim() || undefined;
    return ok(await buildIncidentSummary({ reportId }));
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
    }
    return serverError("Error al generar el resumen de incidencias", error);
  }
}, "informesMensuales.informes");
