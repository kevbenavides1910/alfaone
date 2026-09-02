import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { enrollFingerprintOnDevice } from "@/modules/finger-system/services/finger-device-enroll";
import { startFingerprintEnrollment } from "@/modules/finger-system/services/finger-biometric-enroll";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const fingerId = Number.parseInt(String(body.fingerId ?? ""), 10);
      if (!body.deviceId?.trim()) return badRequest("Seleccione un dispositivo biométrico.");
      if (!Number.isFinite(fingerId)) return badRequest("Seleccione el dedo a enrolar.");

      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null;

      // Flujo completo (set_user + enroll + distribución) cuando hay employeeId.
      if (body.employeeId?.trim()) {
        const result = await enrollFingerprintOnDevice({
          employeeId: String(body.employeeId),
          deviceId: String(body.deviceId),
          fingerId,
          userId: session!.user!.id,
          distributeToOtherDevices: body.distribute !== false,
          ipAddress: ip,
        });
        return ok(result);
      }

      const attUserId = Number.parseInt(String(body.attUserId ?? ""), 10);
      if (!Number.isFinite(attUserId)) return badRequest("Empleado inválido.");
      if (!body.badgeNumber?.trim()) return badRequest("Badge/AC-No. requerido.");

      const result = await startFingerprintEnrollment({
        deviceId: String(body.deviceId),
        attUserId,
        badgeNumber: String(body.badgeNumber).trim(),
        fingerId,
        userId: session!.user!.id,
        ipAddress: ip,
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
