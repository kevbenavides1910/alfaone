import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeFacturaController } from "@/modules/facturacion-electronica/controllers/factura.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { updateFeFacturaSchema } from "@/modules/facturacion-electronica/validators/factura.schema";

const controller = new FeFacturaController(prisma);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  try {
    const { id } = await ctx.params;
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const factura = await controller.getById(companyCode, id);
    return Response.json({ ok: true, data: factura });
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "edit")) return forbidden();

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = updateFeFacturaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const factura = await controller.update(companyCode, id, parsed.data, session.user.id);
    return ok(factura);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
