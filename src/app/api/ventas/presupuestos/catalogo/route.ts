import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getCatalogForApi } from "@/modules/ventas";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "view")) return forbidden();

  try {
    return ok(await getCatalogForApi());
  } catch (e) {
    return serverError("Error al cargar catálogo", e);
  }
}
