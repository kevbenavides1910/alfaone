import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { forbidden, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeMensajeReceptorController } from "@/modules/facturacion-electronica/controllers/mensaje-receptor.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";

const controller = new FeMensajeReceptorController(prisma);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.mensajes_receptor", "view")) return forbidden();

  try {
    const { id } = await ctx.params;
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const mensaje = await controller.getById(companyCode, id);
    return Response.json({ ok: true, data: mensaje });
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.mensajes_receptor", "edit")) return forbidden();

  try {
    const { id } = await ctx.params;
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const result = await controller.enviar(companyCode, id, session.user.id);
    return Response.json({ ok: true, data: result });
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
