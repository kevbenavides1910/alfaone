import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { getLiveDevicePositions } from "@/modules/syntra/services/patrol-live-tracking-service";

export const GET = withPermission(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const deviceId = url.searchParams.get("deviceId");
    const routeId = url.searchParams.get("routeId");
    const devices = await getLiveDevicePositions({ deviceId, routeId });
    return ok({ updatedAt: new Date().toISOString(), devices });
  } catch (e) {
    return serverError("Error al obtener posiciones GPS", e);
  }
}, "recorridos.dashboard", "view");
