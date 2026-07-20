import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { badRequest, ok, unauthorized, serverError } from "@/lib/api/response";
import {
  listUserPreferences,
  preferencesUpdateSchema,
  updateUserPreferences,
} from "@/modules/notifications";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const preferences = await listUserPreferences(session.user.id);
    return ok({ preferences });
  } catch (e) {
    return serverError("Error al cargar preferencias", e);
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json().catch(() => null);
    const parsed = preferencesUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos");

    await updateUserPreferences(session.user.id, parsed.data.preferences);
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error al guardar preferencias", e);
  }
}
