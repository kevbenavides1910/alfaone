import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { settingsUpdateSchema, testSyntraAiConnection } from "@/modules/syntra-ai/services/syntra-ai-config";

function canManageSyntraAi(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return isPlatformAdmin(session) || hasPermission(session, "plataforma.catalogs", "edit");
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageSyntraAi(session)) return forbidden();

  let body: unknown = {};
  try {
    if (req.headers.get("content-length") !== "0") body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = settingsUpdateSchema.partial().safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const result = await testSyntraAiConnection(parsed.data);
    return ok(result);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error de conexión");
  }
}
