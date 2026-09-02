import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { linkExpensesToNafOc } from "@/modules/presupuestos/services/link-expenses-to-naf-oc";

/**
 * POST /api/expenses/ordenes-compra/link
 * Backfill: liga gastos «Orden de compra» con N° referencia a OC NAF.
 */
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "gastos.expenses", "edit")) return forbidden();

  try {
    const data = await linkExpensesToNafOc({ onlyUnlinked: true });
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al ligar OC NAF";
    return serverError(message, e);
  }
}
