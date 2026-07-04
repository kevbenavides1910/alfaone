import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { lookupContribuyenteHacienda } from "@/modules/facturacion-electronica/services/hacienda/contribuyente-lookup.service";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  const identificacion = new URL(req.url).searchParams.get("identificacion")?.trim();
  if (!identificacion) return badRequest("Parámetro identificacion requerido");

  try {
    const data = await lookupContribuyenteHacienda(identificacion);
    if (!data) return notFound("Contribuyente no encontrado en Hacienda");
    return ok(data);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
