import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { createFePuntoVentaSchema } from "@/modules/facturacion-electronica/validators/empresa.schema";

const controller = new FeEmpresaConfigController(prisma);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = createFePuntoVentaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const { id: sucursalId } = await ctx.params;
    const companyCode = resolveFeCompanyCodeFromSession(session, body.companyCode);
    const pv = await controller.createPuntoVenta(companyCode, sucursalId, parsed.data, session.user.id);
    return created(pv);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
