import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listOpRoles } from "@/modules/naf-operaciones/services/list-roles";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.roles", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const page = Number.parseInt(sp.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
    const semanaPgrRaw = sp.get("semanaPgr");
    const noRolRaw = sp.get("noRol");
    const result = await listOpRoles({
      q: (sp.get("nombre")?.trim() || sp.get("q") || undefined),
      noCiaGrupo: sp.get("noCiaGrupo") ?? undefined,
      noContrato: sp.get("noContrato") ?? undefined,
      noUbicacion: sp.get("noUbicacion") ?? undefined,
      estado: sp.get("estado") ?? undefined,
      semanaPgr: semanaPgrRaw != null && semanaPgrRaw !== "" ? Number(semanaPgrRaw) : undefined,
      noRol: noRolRaw != null && noRolRaw !== "" ? Number(noRolRaw) : undefined,
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
    });
    return ok(result);
  } catch (e) {
    return serverError("Error al listar roles OP", e);
  }
}
