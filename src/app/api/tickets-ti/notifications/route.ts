import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  listUserNotifications,
  markAllNotificationsRead,
  countUnreadNotifications,
} from "@/modules/tickets-ti";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view")) return forbidden();

  try {
    const [items, unread] = await Promise.all([
      listUserNotifications(session.user.id),
      countUnreadNotifications(session.user.id),
    ]);
    return ok({ items, unread });
  } catch (e) {
    return serverError("Error al cargar notificaciones", e);
  }
}

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view")) return forbidden();

  try {
    await markAllNotificationsRead(session.user.id);
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error al marcar notificaciones", e);
  }
}
