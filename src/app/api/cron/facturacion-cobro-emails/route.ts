import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { runAutomaticCobroEmails } from "@/modules/presupuestos/services/facturacion-cobro-email-cron";

async function executeAutoEmails() {
  const result = await runAutomaticCobroEmails();
  return ok(result);
}

const adminRunHandler = withPermission(async () => {
  try {
    return await executeAutoEmails();
  } catch (e) {
    return serverError("Error al ejecutar correos automáticos de cobro", e);
  }
}, "facturacion.cxc", "edit");

/** Job diario (8:00 AM en cron del VPS) o ejecución manual por admin. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Record<string, never>> }
) {
  if (isCronAuthorized(req)) {
    try {
      return await executeAutoEmails();
    } catch (e) {
      return serverError("Error al ejecutar correos automáticos de cobro", e);
    }
  }
  return adminRunHandler(req, ctx);
}
