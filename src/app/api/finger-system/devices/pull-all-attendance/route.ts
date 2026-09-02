import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { pullAllDevicesAttendance } from "@/modules/finger-system/services/finger-device-pull";
import { ensureSeedFingerDevices } from "@/modules/finger-system/services/finger-devices-seed";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      await ensureSeedFingerDevices();
      const daysBack = Number.parseInt(String(body.daysBack ?? 3), 10);
      const result = await pullAllDevicesAttendance({
        userId: session!.user!.id,
        daysBack: Number.isFinite(daysBack) ? daysBack : 3,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible traer marcas de los relojes.", e);
    }
  },
  "fingerSystem.dispositivos",
  "edit",
);
