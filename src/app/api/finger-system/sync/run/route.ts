import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { runFingerAutoSync } from "@/modules/finger-system/services/finger-sync-orchestrator";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const result = await runFingerAutoSync({
        userId: session!.user!.id,
        trigger: "manual",
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("Error en sincronización.", e);
    }
  },
  "fingerSystem.mantenimiento",
  "edit",
);
