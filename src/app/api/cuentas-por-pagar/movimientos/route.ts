import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listCxpMovimientos } from "@/modules/cuentas-por-pagar/services/list-cxp-movimientos";
import { cxpMovimientosListSchema } from "@/modules/cuentas-por-pagar/validations/cxp-movimientos.schema";

function firstDayOfMonthIso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function todayIso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "cuentasPorPagar.facturas", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const parsed = cxpMovimientosListSchema.safeParse({
    dateFrom: searchParams.get("dateFrom") ?? firstDayOfMonthIso(now),
    dateTo: searchParams.get("dateTo") ?? todayIso(now),
    company: searchParams.get("company") ?? undefined,
    noProve: searchParams.get("noProve") ?? undefined,
    tipoDocs: [
      ...searchParams.getAll("tipoDocs"),
      ...(searchParams.get("tipoDoc") ? [searchParams.get("tipoDoc")!] : []),
    ],
    documentoClase: searchParams.get("documentoClase") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "50",
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  try {
    const data = await listCxpMovimientos(parsed.data);
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar movimientos CXP";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar movimientos contables CXP", e);
  }
}
