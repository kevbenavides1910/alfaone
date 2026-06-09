import { badRequest, ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  getDevicePendingAuditReport,
  listMarksByImei,
} from "@/modules/syntra/services/patrol-device-pending-service";

/** Compara ultimo snapshot del dispositivo vs marcas recibidas en servidor. */
export const GET = withPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const imei = url.searchParams.get("imei");
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    if (!imei || !desde || !hasta) {
      return badRequest("Parametros imei, desde y hasta son obligatorios (YYYY-MM-DD)");
    }

    const mode = url.searchParams.get("mode") ?? "audit";
    if (mode === "list") {
      const marks = await listMarksByImei({ imei, desde, hasta });
      return ok({ imei, desde, hasta, count: marks.length, marks });
    }

    const report = await getDevicePendingAuditReport({ imei, desde, hasta });
    return ok(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al auditar pendientes";
    if (message.includes("Fecha")) {
      return badRequest(message);
    }
    return serverError("Error en auditoria de marcas por IMEI", e);
  }
}, "recorridos.reportes", "view");
