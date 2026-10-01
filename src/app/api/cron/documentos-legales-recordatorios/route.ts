import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { sendLegalDocumentReminderEmails } from "@/modules/documentos-legales/services/reminder-mail";

async function execute() {
  return ok(await sendLegalDocumentReminderEmails());
}

const adminHandler = withPermission(async () => {
  try {
    return await execute();
  } catch (error) {
    return serverError("Error al enviar recordatorios de documentos legales", error);
  }
}, "documentosLegales.calendario", "admin");

/** Cron diario (días hábiles) o ejecución manual con permiso admin del módulo. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Record<string, never>> },
) {
  if (isCronAuthorized(req)) {
    try {
      return await execute();
    } catch (error) {
      return serverError("Error al enviar recordatorios de documentos legales", error);
    }
  }
  return adminHandler(req, ctx);
}
