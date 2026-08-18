import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { buildFingerAttendanceReport } from "@/modules/finger-system/services/finger-reports";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const fromRaw = sp.get("from");
      const toRaw = sp.get("to") ?? fromRaw;
      if (!fromRaw) return badRequest("Indique el parámetro from (fecha).");

      const from = new Date(fromRaw);
      const to = new Date(toRaw ?? fromRaw);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return badRequest("Fechas inválidas.");
      }

      const company = sp.get("company") ?? undefined;

      return ok(await buildFingerAttendanceReport(from, to, company));
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("Error al generar reporte.", e);
    }
  },
  "fingerSystem.reportes",
  "view",
);
