import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { forbidden, noContent, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { FeCabysFavoritoRepository } from "@/modules/facturacion-electronica/repositories/fe-cabys-favorito.repository";
import { FeEmpresaRepository } from "@/modules/facturacion-electronica/repositories/fe-empresa.repository";

const empresaRepo = new FeEmpresaRepository(prisma);
const favoritoRepo = new FeCabysFavoritoRepository(prisma);

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.facturas", "edit")) return forbidden();

  try {
    const { id } = await ctx.params;
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const empresa = await empresaRepo.findByCompanyCode(companyCode);
    await favoritoRepo.softDelete(id, empresa.id, session.user.id);
    return noContent();
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
