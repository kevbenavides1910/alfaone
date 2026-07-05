import { badRequest, ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { getWelfareHistoryReport } from "@/modules/syntra/services/patrol-welfare-service";

export const GET = withPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    if (!desde || !hasta) {
      return badRequest("Parametros desde y hasta son obligatorios (YYYY-MM-DD)");
    }

    const report = await getWelfareHistoryReport({
      desde,
      hasta,
      imei: url.searchParams.get("imei") ?? undefined,
      routeId: url.searchParams.get("routeId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return ok(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar reporte";
    if (message.includes("Fecha")) {
      return badRequest(message);
    }
    return serverError("Error al generar historial hombre vivo", e);
  }
}, "recorridos.reportes", "view");
