import { badRequest, ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { getOutOfRouteMarksReport } from "@/modules/syntra/services/patrol-out-of-route-marks-service";

export const GET = withPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    if (!desde || !hasta) {
      return badRequest("Parametros desde y hasta son obligatorios (YYYY-MM-DD)");
    }

    const deviceId = url.searchParams.get("deviceId") ?? undefined;
    const imei = url.searchParams.get("imei") ?? undefined;
    const routeId = url.searchParams.get("routeId") ?? undefined;

    const report = await getOutOfRouteMarksReport({
      desde,
      hasta,
      deviceId,
      imei,
      routeId,
    });
    return ok(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar reporte";
    if (message.includes("Fecha")) {
      return badRequest(message);
    }
    return serverError("Error al generar marcas fuera de ruta", e);
  }
}, "recorridos.reportes", "view");
