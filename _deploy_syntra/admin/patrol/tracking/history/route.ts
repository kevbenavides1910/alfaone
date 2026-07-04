import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { getGpsTrackHistory } from "@/modules/syntra/services/patrol-live-tracking-service";

export const GET = withPermission(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const result = await getGpsTrackHistory({
      deviceId: url.searchParams.get("deviceId"),
      routeId: url.searchParams.get("routeId"),
      desde: url.searchParams.get("desde"),
      hasta: url.searchParams.get("hasta"),
    });
    return ok(result);
  } catch (e) {
    return serverError("Error al obtener recorrido GPS", e);
  }
}, "recorridos.dashboard", "view");
