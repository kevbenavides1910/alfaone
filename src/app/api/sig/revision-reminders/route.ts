import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listSigRevisionReminders } from "@/modules/sig/services/revision-reminders";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  try {
    const withinDays = req.nextUrl.searchParams.get("withinDays");
    const days = withinDays ? Number(withinDays) : 30;
    const reminders = await listSigRevisionReminders(Number.isNaN(days) ? 30 : days);
    return ok(reminders);
  } catch (e) {
    return serverError("Error al obtener recordatorios de revisión", e);
  }
}
