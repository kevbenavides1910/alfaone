import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { FeClienteService } from "@/modules/facturacion-electronica/services/cliente.service";
import { updateFeClienteSchema } from "@/modules/facturacion-electronica/validators/cliente.schema";

const service = new FeClienteService(prisma);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "edit")) return forbidden();

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = updateFeClienteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const cliente = await service.update(companyCode, id, parsed.data, session.user.id);
    return ok(cliente);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
