import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listCxpFacturas } from "@/modules/cuentas-por-pagar/services/list-cxp-facturas";
import { cxpFacturasListSchema } from "@/modules/cuentas-por-pagar/validations/cxp-list.schema";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "cuentasPorPagar.facturas", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const parsed = cxpFacturasListSchema.safeParse({
    periodMonth: searchParams.get("periodMonth") ?? String(now.getMonth() + 1),
    periodYear: searchParams.get("periodYear") ?? String(now.getFullYear()),
    company: searchParams.get("company") ?? undefined,
    noProve: searchParams.get("noProve") ?? undefined,
    tipoDoc: searchParams.get("tipoDoc") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    estado: searchParams.get("estado") ?? "ALL",
    faeLink: searchParams.get("faeLink") ?? "ALL",
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "50",
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  try {
    const data = await listCxpFacturas(parsed.data);
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar CXP";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar cuentas por pagar", e);
  }
}
