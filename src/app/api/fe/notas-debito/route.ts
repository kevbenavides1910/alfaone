import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeNotaController } from "@/modules/facturacion-electronica/controllers/nota.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { createFeNotaSchema } from "@/modules/facturacion-electronica/validators/nota.schema";

const controller = new FeNotaController(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = createFeNotaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const nota = await controller.createDebito(companyCode, parsed.data, session.user.id);
    return created(nota);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function GET() {
  return badRequest("Use POST para crear notas de débito");
}
