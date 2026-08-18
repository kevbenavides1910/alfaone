import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { startFingerprintEnrollment } from "@/modules/finger-system/services/finger-biometric-enroll";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const attUserId = Number.parseInt(String(body.attUserId ?? ""), 10);
      const fingerId = Number.parseInt(String(body.fingerId ?? ""), 10);

      if (!body.deviceId?.trim()) return badRequest("Seleccione un dispositivo biométrico.");
      if (!Number.isFinite(attUserId)) return badRequest("Empleado inválido.");
      if (!Number.isFinite(fingerId)) return badRequest("Seleccione el dedo a enrolar.");
      if (!body.badgeNumber?.trim()) return badRequest("Badge/AC-No. requerido.");

      const result = await startFingerprintEnrollment({
        deviceId: String(body.deviceId),
        attUserId,
        badgeNumber: String(body.badgeNumber).trim(),
        fingerId,
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });

      return ok(result);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible iniciar el enrolamiento.", e);
    }
  },
  "fingerSystem.biometria",
  "edit",
);
