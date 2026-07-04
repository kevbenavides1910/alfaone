import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { FeReciboPagoService } from "@/modules/facturacion-electronica/services/recibo-pago.service";

const service = new FeReciboPagoService(prisma);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibos_pago", "edit")) return forbidden();
  try {
    const { id } = await params;
    const companyCode = await resolveFeCompanyCode(session, new URL(req.url).searchParams.get("companyCode"));
    const result = await service.encolarEnvio(companyCode, id, session.user.id);
    return ok(result);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
