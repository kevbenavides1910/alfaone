import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";

const controller = new FeEmpresaConfigController(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    const companyCode = resolveFeCompanyCodeFromSession(session, body.companyCode);

    const result = await controller.syncImap(companyCode);
    return ok({
      queued: false,
      processed: result.processed,
      skipped: result.skipped,
      lastUid: result.lastUid,
      message: `Sincronización completada: ${result.processed} nuevos, ${result.skipped} omitidos.`,
    });
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
