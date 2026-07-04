import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { searchActividadesEconomicas } from "@/modules/facturacion-electronica/services/hacienda/actividades-lookup.service";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const identificacion = searchParams.get("identificacion")?.trim() ?? undefined;
  const topRaw = searchParams.get("top");
  const top = topRaw ? Number(topRaw) : 20;

  if (!q) return badRequest("Parámetro q requerido");

  try {
    const companyCode = await resolveFeCompanyCode(session, searchParams.get("companyCode"));
    const items = await searchActividadesEconomicas({ q, companyCode, identificacion, top });
    return ok({ items, total: items.length });
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
