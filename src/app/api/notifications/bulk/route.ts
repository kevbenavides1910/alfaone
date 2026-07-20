import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { badRequest, ok, unauthorized, serverError } from "@/lib/api/response";
import { bulkUpdateNotifications, bulkActionSchema } from "@/modules/notifications";

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json().catch(() => null);
    const parsed = bulkActionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos");

    await bulkUpdateNotifications(
      session.user.id,
      parsed.data.ids,
      parsed.data.action,
      clientIp(req),
    );
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error en acción masiva", e);
  }
}
