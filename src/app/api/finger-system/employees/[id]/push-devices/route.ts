import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { pushEmployeeToDevices } from "@/modules/finger-system/services/finger-device-push";

export const POST = withPermission(
  async (req: NextRequest, { session, params }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const deviceIds = Array.isArray(body.deviceIds)
        ? body.deviceIds.map(String).filter(Boolean)
        : undefined;
      const result = await pushEmployeeToDevices({
        employeeId: params.id,
        userId: session!.user!.id,
        deviceIds,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible enviar al reloj.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);
