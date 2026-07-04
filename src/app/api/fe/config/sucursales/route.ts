import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { createFeSucursalSchema } from "@/modules/facturacion-electronica/validators/empresa.schema";

const controller = new FeEmpresaConfigController(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = createFeSucursalSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = resolveFeCompanyCodeFromSession(session, body.companyCode);
    const sucursal = await controller.createSucursal(companyCode, parsed.data, session.user.id);
    return created(sucursal);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
