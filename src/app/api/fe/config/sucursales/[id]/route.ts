import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, noContent, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { updateFeSucursalSchema } from "@/modules/facturacion-electronica/validators/empresa.schema";

const controller = new FeEmpresaConfigController(prisma);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = updateFeSucursalSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const { id } = await ctx.params;
    const companyCode = resolveFeCompanyCodeFromSession(session, body.companyCode);
    const sucursal = await controller.updateSucursal(companyCode, id, parsed.data, session.user.id);
    return ok(sucursal);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const { id } = await ctx.params;
    const companyCode = resolveFeCompanyCodeFromSession(session, new URL(req.url).searchParams.get("companyCode"));
    await controller.deleteSucursal(companyCode, id, session.user.id);
    return noContent();
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
