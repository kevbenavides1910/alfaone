import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { getNafEmployeeBySourceKey } from "@/modules/empleados-naf/services/employee-detail";

type Params = { params: Promise<{ key: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.list", "view")) return forbidden();

  try {
    const { key } = await params;
    const sourceKey = decodeURIComponent(key);
    const employee = await getNafEmployeeBySourceKey(sourceKey);
    if (!employee) return notFound("Empleado NAF no encontrado");
    return ok(employee);
  } catch (e) {
    return serverError("Error al cargar empleado NAF", e);
  }
}
