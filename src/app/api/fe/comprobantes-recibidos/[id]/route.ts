import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeComprobanteRecibidoController } from "@/modules/facturacion-electronica/controllers/comprobante-recibido.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { responderComprobanteRecibidoSchema } from "@/modules/facturacion-electronica/validators/comprobante-recibido.schema";

const controller = new FeComprobanteRecibidoController(prisma);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "view")) return forbidden();

  try {
    const { id } = await params;
    const companyCode = await resolveFeCompanyCode(
      session,
      new URL(_req.url).searchParams.get("companyCode")
    );
    const item = await controller.getById(companyCode, id);
    return ok(item);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = responderComprobanteRecibidoSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const item = await controller.responder(companyCode, id, parsed.data, session.user.id);
    return ok(item);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
