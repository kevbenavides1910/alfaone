import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { lookupCabysByCodigo, searchCabys, browseCabys } from "@/modules/facturacion-electronica/services/hacienda/cabys-lookup.service";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const codigo = searchParams.get("codigo")?.trim() ?? "";
  const browse = searchParams.get("browse") === "1";
  const pathRaw = searchParams.get("path")?.trim() ?? "";
  const topRaw = searchParams.get("top");
  const top = topRaw ? Number(topRaw) : 15;

  try {
    if (browse) {
      const path = pathRaw ? pathRaw.split("|").map((s) => s.trim()).filter(Boolean) : [];
      const result = await browseCabys(path, top);
      return ok(result);
    }

    if (codigo) {
      const item = await lookupCabysByCodigo(codigo);
      if (!item) return notFound("Código CABYS no encontrado");
      return ok({ items: [item], total: 1 });
    }

    if (!q) return badRequest("Parámetro q o codigo requerido");

    const items = await searchCabys(q, top);
    return ok({ items, total: items.length });
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
