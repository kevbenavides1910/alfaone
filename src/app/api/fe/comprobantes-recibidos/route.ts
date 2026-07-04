import { NextRequest } from "next/server";
import type { FeComprobanteRecibidoEstado } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeComprobanteRecibidoController } from "@/modules/facturacion-electronica/controllers/comprobante-recibido.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";

const controller = new FeComprobanteRecibidoController(prisma);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "view")) return forbidden();

  try {
    const url = new URL(req.url);
    const companyCode = await resolveFeCompanyCode(session, url.searchParams.get("companyCode"));
    const estado = url.searchParams.get("estado") as FeComprobanteRecibidoEstado | null;
    const items = await controller.list(companyCode, estado ?? undefined);
    return ok(items);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.recibidos", "edit")) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    const companyCode = await resolveFeCompanyCode(session, body.companyCode);

    const result = await controller.sync(companyCode);
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
