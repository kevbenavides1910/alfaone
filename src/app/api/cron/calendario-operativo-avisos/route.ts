import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { sendCalendarioDueEmails } from "@/modules/naf-operaciones/services/calendario-avisos";

async function execute() {
  return ok(await sendCalendarioDueEmails());
}

const adminHandler = withPermission(async () => {
  try {
    return await execute();
  } catch (error) {
    return serverError("Error al enviar avisos del calendario operativo", error);
  }
}, "nafOperaciones.calendario", "edit");

/** Cron diario o ejecución manual con permiso de edición del calendario. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Record<string, never>> },
) {
  if (isCronAuthorized(req)) {
    try {
      return await execute();
    } catch (error) {
      return serverError("Error al enviar avisos del calendario operativo", error);
    }
  }
  return adminHandler(req, ctx);
}
