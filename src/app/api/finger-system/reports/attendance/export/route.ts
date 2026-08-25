import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, serverError } from "@/lib/api/response";
import { exportFingerAttendanceCsv } from "@/modules/finger-system/services/finger-reports";

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

      const { filename, body } = await exportFingerAttendanceCsv(from, to, company);

      return new Response(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("Error al exportar reporte.", e);
    }
  },
  "fingerSystem.reportes",
  "edit",
);
