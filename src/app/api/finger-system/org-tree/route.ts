import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { buildFingerOrgTree } from "@/modules/finger-system/services/finger-org-tree";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !hasPermission(session, "fingerSystem.empleados", "view") &&
    !hasPermission(session, "fingerSystem.empresas", "view")
  ) {
    return forbidden();
  }

  try {
    return ok(await buildFingerOrgTree());
  } catch (e) {
    return serverError("No fue posible cargar el árbol de empresas.", e);
  }
}
