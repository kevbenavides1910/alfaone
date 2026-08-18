import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { runFingerAutoSync } from "@/modules/finger-system/services/finger-sync-orchestrator";

async function executeSync(req: NextRequest, userId?: string | null) {
  const result = await runFingerAutoSync({
    userId: userId ?? null,
    trigger: userId ? "manual" : "cron",
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null,
  });
  return ok(result);
}

const manualHandler = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      return await executeSync(req, session!.user!.id);
    } catch (e) {
      return serverError("Error en sincronización Finger System.", e);
    }
  },
  "fingerSystem.mantenimiento",
  "edit",
);

export async function POST(req: NextRequest, ctx: { params: Promise<Record<string, never>> }) {
  if (isCronAuthorized(req)) {
    try {
      return await executeSync(req);
    } catch (e) {
      return serverError("Error en cron Finger System.", e);
    }
  }
  return manualHandler(req, ctx);
}
