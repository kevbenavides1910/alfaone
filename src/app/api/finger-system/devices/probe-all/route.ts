import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { runFingerDeviceStatusSync } from "@/modules/finger-system/services/finger-device-sync";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const result = await runFingerDeviceStatusSync({
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });
      return ok(result);
    } catch (e) {
      return serverError("No fue posible verificar dispositivos.", e);
    }
  },
  "fingerSystem.dispositivos",
  "edit",
);
