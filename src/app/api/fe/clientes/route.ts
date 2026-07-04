import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { FeClienteService } from "@/modules/facturacion-electronica/services/cliente.service";
import { createFeClienteSchema } from "@/modules/facturacion-electronica/validators/cliente.schema";

const service = new FeClienteService(prisma);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  try {
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const clientes = await service.list(companyCode);
    return ok(clientes);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = createFeClienteSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const cliente = await service.create(companyCode, parsed.data, session.user.id);
    return created(cliente);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
