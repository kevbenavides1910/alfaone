import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";

const controller = new FeEmpresaConfigController(prisma);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  const companyOverride = new URL(req.url).searchParams.get("companyCode") ?? undefined;

  try {
    const companyCode = resolveFeCompanyCodeFromSession(session, companyOverride);
    const config = await controller.getConfig(companyCode);
    return ok(config);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
