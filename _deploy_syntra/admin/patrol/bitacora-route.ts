import { badRequest, ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { listPatrolBitacoraEntries } from "@/modules/syntra/services/patrol-bitacora-service";

export const GET = withPermission(async (req) => {
  try {
    const url = new URL(req.url);
    const desde = url.searchParams.get("desde") ?? undefined;
    const hasta = url.searchParams.get("hasta") ?? undefined;
    const imei = url.searchParams.get("imei") ?? undefined;
    const unlinkedOnly = url.searchParams.get("unlinkedOnly") === "1";

    const rows = await listPatrolBitacoraEntries({ desde, hasta, imei, unlinkedOnly });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar bitácora", e);
  }
}, "recorridos.reportes", "view");
