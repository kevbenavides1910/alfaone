import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeComprobanteRecibidoController } from "@/modules/facturacion-electronica/controllers/comprobante-recibido.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";

const controller = new FeComprobanteRecibidoController(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "edit")) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const result = await controller.purgeInvalid(companyCode, session.user.id);
    return ok(result);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
