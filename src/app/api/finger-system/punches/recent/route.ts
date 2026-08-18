import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listRecentFingerPunches } from "@/modules/finger-system/services/finger-live-punches";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const limit = Number.parseInt(sp.get("limit") ?? "30", 10);
      const hoursBack = Number.parseInt(sp.get("hoursBack") ?? "24", 10);

      const items = await listRecentFingerPunches({
        limit: Number.isNaN(limit) ? 30 : limit,
        hoursBack: Number.isNaN(hoursBack) ? 24 : hoursBack,
        q: sp.get("q") ?? undefined,
        company: sp.get("company") ?? undefined,
      });

      return ok({ items });
    } catch (e) {
      return serverError("Error al listar marcas recientes.", e);
    }
  },
  "fingerSystem.marcasEnVivo",
  "view",
);
