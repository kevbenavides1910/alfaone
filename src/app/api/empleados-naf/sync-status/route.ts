import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getLatestNafSyncRun } from "@/modules/empleados-naf/services/sync-employees";
import { prisma } from "@/modules/core/db/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.list", "view")) return forbidden();

  try {
    const [lastSync, totalEmployees] = await Promise.all([
      getLatestNafSyncRun(),
      prisma.nafEmployee.count(),
    ]);
    return ok({ lastSync, totalEmployees });
  } catch (e) {
    return serverError("Error al consultar estado de sincronización NAF", e);
  }
}
