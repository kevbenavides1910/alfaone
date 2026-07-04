import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { FeReciboPagoService } from "@/modules/facturacion-electronica/services/recibo-pago.service";
import { createFeReciboPagoSchema } from "@/modules/facturacion-electronica/validators/recibo.schema";

const service = new FeReciboPagoService(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibos_pago", "edit")) return forbidden();
  try {
    const body = await req.json();
    const parsed = createFeReciboPagoSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const row = await service.create(companyCode, parsed.data, session.user.id);
    return created(row);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibos_pago", "view")) return forbidden();
  try {
    const { searchParams } = new URL(req.url);
    const companyCode = await resolveFeCompanyCode(session, searchParams.get("companyCode") ?? undefined);
    const page = Number(searchParams.get("page") ?? 1);
    const pageSize = Number(searchParams.get("pageSize") ?? 20);
    const result = await service.list(companyCode, page, pageSize);
    return ok(result);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
