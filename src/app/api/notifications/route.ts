import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, serverError } from "@/lib/api/response";
import {
  countUnreadInbox,
  listInboxNotifications,
  markAllNotificationsRead,
} from "@/modules/notifications";

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const [items, unread] = await Promise.all([
      listInboxNotifications(session.user.id),
      countUnreadInbox(session.user.id),
    ]);
    return ok({ items, unread });
  } catch (e) {
    return serverError("Error al cargar notificaciones", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    await markAllNotificationsRead(session.user.id, clientIp(req));
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error al marcar notificaciones", e);
  }
}
