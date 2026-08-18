import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { calculateFingerAttendance } from "@/modules/finger-system/services/finger-attendance-calc";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const fromRaw = body.from ?? new Date().toISOString().slice(0, 10);
      const toRaw = body.to ?? fromRaw;

      const from = new Date(fromRaw);
      const to = new Date(toRaw);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return badRequest("Fechas inválidas.");
      }

      const result = await calculateFingerAttendance({
        from,
        to,
        userId: session!.user!.id,
        company: typeof body.company === "string" ? body.company : undefined,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });

      return ok(result);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible calcular la asistencia.", e);
    }
  },
  "fingerSystem.asistencia",
  "edit",
);
