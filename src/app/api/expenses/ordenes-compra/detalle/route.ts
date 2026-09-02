import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, notFound } from "@/lib/api/response";
import { getOrdenCompraDetalleNaf } from "@/modules/presupuestos/services/list-ordenes-compra-naf";
import { ordenesCompraDetalleSchema } from "@/modules/presupuestos/validations/ordenes-compra.schema";

/**
 * GET /api/expenses/ordenes-compra/detalle?noOrden=&company=&noCia=
 * Cabecera + líneas de una OC Codisa.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "gastos.expenses", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const parsed = ordenesCompraDetalleSchema.safeParse({
    noOrden: searchParams.get("noOrden") ?? "",
    company: searchParams.get("company") ?? undefined,
    noCia: searchParams.get("noCia") ?? undefined,
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  try {
    const data = await getOrdenCompraDetalleNaf(parsed.data);
    if (!data) return notFound("OC no encontrada en Codisa");
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar detalle OC";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar detalle OC Codisa", e);
  }
}
