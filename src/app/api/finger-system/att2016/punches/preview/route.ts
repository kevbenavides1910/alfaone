import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { previewAtt2016PunchImport } from "@/modules/finger-system/services/att2016-punches-import";

function parseDateParam(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(`${raw.trim()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const from = parseDateParam(req.nextUrl.searchParams.get("from"));
      const to = parseDateParam(req.nextUrl.searchParams.get("to"));
      if (!from || !to) {
        return badRequest("Indique parámetros from y to (YYYY-MM-DD).");
      }
      return ok(await previewAtt2016PunchImport(from, to));
    } catch (e) {
      if (e instanceof Error && e.message.includes("fecha")) return badRequest(e.message);
      return serverError("No fue posible analizar marcas en ATT2016.", e);
    }
  },
  "fingerSystem.asistencia",
  "view",
);
