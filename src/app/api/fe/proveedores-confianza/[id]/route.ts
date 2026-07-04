import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeProveedorConfianzaController } from "@/modules/facturacion-electronica/controllers/comprobante-recibido.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { updateFeProveedorConfianzaSchema } from "@/modules/facturacion-electronica/validators/proveedor-confianza.schema";

const controller = new FeProveedorConfianzaController(prisma);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateFeProveedorConfianzaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const items = await controller.update(companyCode, id, parsed.data, session.user.id);
    return ok(items);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const companyCode = await resolveFeCompanyCode(
      session,
      new URL(req.url).searchParams.get("companyCode")
    );
    const result = await controller.remove(companyCode, id, session.user.id);
    return ok(result);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
