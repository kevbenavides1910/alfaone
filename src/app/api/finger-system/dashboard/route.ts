import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getFingerDashboardStats } from "@/modules/finger-system";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.dashboard", "view")) return forbidden();

  try {
    return ok(await getFingerDashboardStats());
  } catch (e) {
    return serverError("No fue posible cargar el dashboard de Finger System.", e);
  }
}
