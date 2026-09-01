import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  getSyntraAiSettingsPublic,
  settingsUpdateSchema,
  updateSyntraAiSettings,
} from "@/modules/syntra-ai/services/syntra-ai-config";

function canManageSyntraAi(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return isPlatformAdmin(session) || hasPermission(session, "plataforma.catalogs", "edit");
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageSyntraAi(session)) return forbidden();

  try {
    const data = await getSyntraAiSettingsPublic();
    return ok(data);
  } catch (e) {
    return serverError("Error al leer configuración Syntra IA", e);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageSyntraAi(session)) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const data = await updateSyntraAiSettings(parsed.data);
    return ok(data);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error al guardar", e);
  }
}
