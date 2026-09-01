import { NextRequest } from "next/server";
import { getSession, isAdmin } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { syncContractLocationsFromNaf } from "@/modules/presupuestos/services/sync-contract-locations-from-naf";

/**
 * Sincroniza ubicaciones de contratos desde Oracle Operaciones (.6).
 * Fuente: AROPMR (roles activos) + ARCOUB (descripción y NO_ZONA_OPERACIONES).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  try {
    const url = req.nextUrl;
    const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
    const result = await syncContractLocationsFromNaf({ dryRun });
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al sincronizar ubicaciones NAF";
    if (message.includes("Oracle NAF no configurado")) return badRequest(message);
    return serverError(message, e);
  }
}
