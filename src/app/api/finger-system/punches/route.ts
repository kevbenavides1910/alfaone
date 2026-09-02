import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { listFingerPunches } from "@/modules/finger-system/services/finger-punches-list";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const sourceRaw = sp.get("source");
      const source =
        sourceRaw === "DEVICE" || sourceRaw === "ATT2016" ? sourceRaw : undefined;
      const data = await listFingerPunches({
        page: Number(sp.get("page") || 1),
        pageSize: Number(sp.get("pageSize") || 25),
        q: sp.get("q") || undefined,
        employeeId: sp.get("employeeId") || undefined,
        deviceId: sp.get("deviceId") || undefined,
        badgeNumber: sp.get("badgeNumber") || undefined,
        source,
        from: sp.get("from") || undefined,
        to: sp.get("to") || undefined,
        company: sp.get("company") || undefined,
      });
      return ok(data);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("Error al listar marcas.", e);
    }
  },
  "fingerSystem.marcasEnVivo",
  "view",
);
