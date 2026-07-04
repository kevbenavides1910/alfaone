import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, created, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeDomainError } from "@/modules/facturacion-electronica/errors/fe-errors";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { FeCabysFavoritoRepository } from "@/modules/facturacion-electronica/repositories/fe-cabys-favorito.repository";
import { FeEmpresaRepository } from "@/modules/facturacion-electronica/repositories/fe-empresa.repository";
import { createFeCabysFavoritoSchema } from "@/modules/facturacion-electronica/validators/cabys-favorito.schema";

const empresaRepo = new FeEmpresaRepository(prisma);
const favoritoRepo = new FeCabysFavoritoRepository(prisma);

function serializeFavorito(row: {
  id: string;
  codigo: string;
  descripcion: string;
  impuesto: { toString(): string } | null;
}) {
  return {
    id: row.id,
    codigo: row.codigo,
    descripcion: row.descripcion,
    impuesto: row.impuesto != null ? Number(row.impuesto.toString()) : null,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "view")) return forbidden();

  try {
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const empresa = await empresaRepo.findByCompanyCode(companyCode);
    const items = await favoritoRepo.list(empresa.id);
    return ok({ items: items.map(serializeFavorito) });
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
    const parsed = createFeCabysFavoritoSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const companyCode = await resolveFeCompanyCode(session, body.companyCode);
    const empresa = await empresaRepo.findByCompanyCode(companyCode);
    const item = await favoritoRepo.upsert(empresa.id, parsed.data, session.user.id);
    return created(serializeFavorito(item));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Máximo")) {
      return mapFeErrorToResponse(new FeDomainError(e.message, "FE_CABYS_FAVORITO_LIMITE", 400));
    }
    return mapFeErrorToResponse(e);
  }
}
