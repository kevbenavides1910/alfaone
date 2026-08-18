import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { listFingerAttendanceDays } from "@/modules/finger-system/services/finger-attendance-calc";
import type { FingerAttendanceStatus } from "@prisma/client";

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

      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
      const status = sp.get("status") as FingerAttendanceStatus | null;

      return ok(
        await listFingerAttendanceDays({
          from,
          to,
          q: sp.get("q") ?? undefined,
          company: sp.get("company") ?? undefined,
          status: status ?? undefined,
          page: Number.isNaN(page) ? 1 : page,
          pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
        }),
      );
    } catch (e) {
      return serverError("Error al listar asistencia.", e);
    }
  },
  "fingerSystem.asistencia",
  "view",
);
