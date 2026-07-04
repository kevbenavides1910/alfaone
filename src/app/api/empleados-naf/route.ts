import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listNafEmployees } from "@/modules/empleados-naf/services/list-employees";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.list", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const page = Number.parseInt(sp.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);

    const result = await listNafEmployees({
      q: sp.get("q") ?? undefined,
      noCia: sp.get("noCia") ?? undefined,
      estado: sp.get("estado") ?? undefined,
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
    });

    return ok(result);
  } catch (e) {
    return serverError("Error al listar empleados NAF", e);
  }
}
