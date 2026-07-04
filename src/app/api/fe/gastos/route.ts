import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeGastoProveedorController } from "@/modules/facturacion-electronica/controllers/gasto-proveedor.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";

const controller = new FeGastoProveedorController(prisma);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.gastos", "view")) return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const companyCode = await resolveFeCompanyCode(session, searchParams.get("companyCode") ?? undefined);
    const desdeRaw = searchParams.get("desde");
    const hastaRaw = searchParams.get("hasta");
    if (!desdeRaw || !hastaRaw) {
      return badRequest("Indique parámetros desde y hasta (YYYY-MM-DD)");
    }

    const desde = new Date(`${desdeRaw}T00:00:00`);
    const hasta = new Date(`${hastaRaw}T23:59:59`);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      return badRequest("Fechas inválidas");
    }

    const result = await controller.resumen(companyCode, desde, hasta);
    return ok(result);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
