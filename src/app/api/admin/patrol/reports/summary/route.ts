import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { getPatrolAdminSummary } from "@/modules/syntra/services/patrol-admin-service";

export const GET = withPermission(async () => {
  try {
    const summary = await getPatrolAdminSummary();
    return ok(summary);
  } catch (e) {
    return serverError("Error al generar reporte Alfa One", e);
  }
}, "recorridos.reportes", "view");
