import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { getEmployeeByCode } from "@/modules/empleados/services/employee-detail";

type Params = { params: Promise<{ codigo: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.list", "view")) return forbidden();

  try {
    const { codigo } = await params;
    const decoded = decodeURIComponent(codigo);
    const employee = await getEmployeeByCode(decoded);
    if (!employee) return notFound("Empleado no encontrado");
    return ok(employee);
  } catch (e) {
    return serverError("Error al cargar empleado", e);
  }
}
