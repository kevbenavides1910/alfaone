import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { badRequest, ok, unauthorized, serverError, notFound } from "@/lib/api/response";
import {
  archiveNotification,
  deleteNotification,
  markNotificationRead,
  restoreFromHistory,
} from "@/modules/notifications";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.enum(["read", "archive", "delete", "restore"]),
});

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Acción inválida");

    const ip = clientIp(req);
    switch (parsed.data.action) {
      case "read":
        await markNotificationRead(session.user.id, id, ip);
        break;
      case "archive":
        await archiveNotification(session.user.id, id, ip);
        break;
      case "delete":
        await deleteNotification(session.user.id, id, ip);
        break;
      case "restore": {
        const okRestore = await restoreFromHistory(session.user.id, id, ip);
        if (!okRestore) return notFound("Notificación no encontrada en historial");
        break;
      }
    }
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error al actualizar notificación", e);
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { id } = await context.params;
    await deleteNotification(session.user.id, id, clientIp(req));
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error al eliminar notificación", e);
  }
}
