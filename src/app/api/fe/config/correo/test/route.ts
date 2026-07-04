import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { FeDomainError } from "@/modules/facturacion-electronica/errors/fe-errors";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { testFeCorreoSchema } from "@/modules/facturacion-electronica/validators/correo.schema";

const controller = new FeEmpresaConfigController(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = testFeCorreoSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = resolveFeCompanyCodeFromSession(session, body.companyCode);
    const result = await controller.testCorreo(companyCode, parsed.data);
    return ok({ sentTo: parsed.data.to, messageId: result.messageId });
  } catch (e) {
    if (e instanceof FeDomainError) return mapFeErrorToResponse(e);
    const msg = e instanceof Error ? e.message : "Error SMTP";
    return badRequest(`No se pudo enviar el correo de prueba: ${msg}`);
  }
}
