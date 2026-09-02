import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { calculateFingerAttendance } from "@/modules/finger-system/services/finger-attendance-calc";
import { syncOdooPunchesIntoFingerCache } from "@/modules/finger-system/services/odoo-biometric-attendance";

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

      const odooSync = await syncOdooPunchesIntoFingerCache({ from, to }).catch((e) => ({
        inserted: 0,
        skipped: 0,
        error: e instanceof Error ? e.message : "sync error",
      }));

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

      return ok({ ...result, odooSync });
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible calcular la asistencia.", e);
    }
  },
  "fingerSystem.asistencia",
  "edit",
);
