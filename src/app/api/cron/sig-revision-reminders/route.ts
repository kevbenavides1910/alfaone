import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { sendSigRevisionReminderEmails } from "@/modules/sig/services/revision-reminder-emails";

async function execute(withinDays: number) {
  const result = await sendSigRevisionReminderEmails(withinDays);
  return ok(result);
}

const adminHandler = withPermission(async (req) => {
  try {
    const withinDays = Number(req.nextUrl.searchParams.get("withinDays") ?? 30);
    return await execute(Number.isFinite(withinDays) ? withinDays : 30);
  } catch (e) {
    return serverError("Error al enviar recordatorios de vigencia SIG", e);
  }
}, "sig.documentos", "admin");

/** Cron diario o ejecución manual (admin documentos). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Record<string, never>> }
) {
  const withinDays = Number(req.nextUrl.searchParams.get("withinDays") ?? 30);
  const days = Number.isFinite(withinDays) ? withinDays : 30;
  if (isCronAuthorized(req)) {
    try {
      return await execute(days);
    } catch (e) {
      return serverError("Error al enviar recordatorios de vigencia SIG", e);
    }
  }
  return adminHandler(req, ctx);
}
