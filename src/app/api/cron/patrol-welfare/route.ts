import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError, unauthorized } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { runPatrolWelfareCron } from "@/modules/syntra/services/patrol-welfare-service";

async function executeWelfareCron() {
  const result = await runPatrolWelfareCron();
  return ok(result);
}

const adminRunHandler = withPermission(async () => {
  try {
    return await executeWelfareCron();
  } catch (e) {
    return serverError("Error al ejecutar hombre vivo programado", e);
  }
}, "recorridos.reportes", "edit");

/** Job periódico (cada 5–15 min en cron del VPS) o ejecución manual por admin. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Record<string, never>> },
) {
  if (isCronAuthorized(req)) {
    try {
      return await executeWelfareCron();
    } catch (e) {
      return serverError("Error al ejecutar hombre vivo programado", e);
    }
  }
  return adminRunHandler(req, ctx);
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized();
  try {
    return await executeWelfareCron();
  } catch (e) {
    return serverError("Error al ejecutar hombre vivo programado", e);
  }
}
