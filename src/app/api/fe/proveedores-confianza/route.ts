import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeProveedorConfianzaController } from "@/modules/facturacion-electronica/controllers/comprobante-recibido.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { createFeProveedorConfianzaSchema } from "@/modules/facturacion-electronica/validators/proveedor-confianza.schema";

const controller = new FeProveedorConfianzaController(prisma);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "view")) return forbidden();

  try {
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const items = await controller.list(companyCode);
    return ok(items);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = createFeProveedorConfianzaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const item = await controller.create(companyCode, parsed.data, session.user.id);
    return created(item);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
