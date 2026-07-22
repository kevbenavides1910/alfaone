import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listCxpProveedores } from "@/modules/cuentas-por-pagar/services/list-cxp-proveedores";
import { cxpProveedoresListSchema } from "@/modules/cuentas-por-pagar/validations/cxp-list.schema";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "cuentasPorPagar.facturas", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const parsed = cxpProveedoresListSchema.safeParse({
    company: searchParams.get("company") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: searchParams.get("limit") ?? "50",
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  try {
    const data = await listCxpProveedores(parsed.data);
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar proveedores CXP";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar proveedores CXP", e);
  }
}
