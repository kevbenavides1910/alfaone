import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeFacturaController } from "@/modules/facturacion-electronica/controllers/factura.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import {
  createFeFacturaSchema,
  listFeFacturasSchema,
} from "@/modules/facturacion-electronica/validators/factura.schema";

const controller = new FeFacturaController(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = createFeFacturaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const factura = await controller.create(companyCode, parsed.data, session.user.id);
    return created(factura);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const parsed = listFeFacturasSchema.safeParse({
    companyCode: searchParams.get("companyCode") ?? undefined,
    tipoDocumento: searchParams.get("tipoDocumento") ?? undefined,
    estado: searchParams.get("estado") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    const companyCode = await resolveFeCompanyCode(session, parsed.data.companyCode);
    const result = await controller.list(companyCode, parsed.data);
    return ok(result);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
