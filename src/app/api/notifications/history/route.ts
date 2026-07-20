import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, serverError } from "@/lib/api/response";
import { historyQuerySchema, listNotificationHistory } from "@/modules/notifications";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const sp = req.nextUrl.searchParams;
    const parsed = historyQuerySchema.safeParse({
      q: sp.get("q") ?? undefined,
      moduleKey: sp.get("moduleKey") ?? undefined,
      priority: sp.get("priority") ?? undefined,
      status: sp.get("status") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      limit: sp.get("limit") ?? undefined,
      offset: sp.get("offset") ?? undefined,
    });
    const filters = parsed.success ? parsed.data : {};
    const result = await listNotificationHistory(session.user.id, filters);
    return ok(result);
  } catch (e) {
    return serverError("Error al cargar historial", e);
  }
}
