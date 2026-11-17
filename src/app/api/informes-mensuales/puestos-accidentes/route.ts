import { withPermission } from "@/lib/permissions/middleware";
import { notFound, ok, serverError } from "@/lib/api/response";
import { MonthlyReportError } from "@/modules/informes-mensuales/services/reports";
import { buildPuestosAccidentesReport } from "@/modules/informes-mensuales/services/puestos-accidentes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withPermission(async () => {
  try {
    return ok(await buildPuestosAccidentesReport());
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      return error.code === "NOT_FOUND" ? notFound(error.message) : serverError(error.message, error);
    }
    return serverError("Error al generar el reporte de puestos y accidentes", error);
  }
}, "informesMensuales.informes");
