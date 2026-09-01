import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import { listCatalogPositions } from "@/modules/presupuestos/services/contract-positions-catalog";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session) && !hasPermission(session, "plataforma.catalogs", "view")) {
    return forbidden();
  }

  try {
    const url = req.nextUrl;
    const zoneId = url.searchParams.get("zoneId");
    const unassigned = url.searchParams.get("unassigned") === "1";
    const contractId = url.searchParams.get("contractId") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;

    const data = await listCatalogPositions({
      zoneId: zoneId === "NONE" ? "NONE" : zoneId ?? undefined,
      unassigned: unassigned || undefined,
      contractId,
      q,
    });

    return ok(data);
  } catch (e) {
    return serverError("Error al obtener puestos", e);
  }
}
