import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listOrdenesCompraNaf } from "@/modules/presupuestos/services/list-ordenes-compra-naf";
import { ordenesCompraListSchema } from "@/modules/presupuestos/validations/ordenes-compra.schema";

/**
 * GET /api/expenses/ordenes-compra?search=&company=&limit=
 * Órdenes de compra reales Codisa (NAF5.ARIMENCORDEN) para el picker de gastos.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "gastos.expenses", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const parsed = ordenesCompraListSchema.safeParse({
    company: searchParams.get("company") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: searchParams.get("limit") ?? "25",
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  try {
    const data = await listOrdenesCompraNaf(parsed.data);
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar OC Codisa";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar OC Codisa", e);
  }
}
