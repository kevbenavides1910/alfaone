import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { syncAllMissingCxcFromFacturas } from "@/modules/presupuestos/services/sync-cxc-from-factura";

/**
 * POST /api/admin/facturacion/sync-cxc
 * Sincroniza todas las facturas FACTURADO/COBRADO que no tienen documento en CxC.
 * Solo ADMIN.
 */
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "edit")) return forbidden();

  try {
    const result = await syncAllMissingCxcFromFacturas(prisma);
    return ok(result);
  } catch (e) {
    return serverError("Error al sincronizar CxC", e);
  }
}
