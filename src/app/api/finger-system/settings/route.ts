import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { getFingerSettingsPublic, updateFingerSettings } from "@/modules/finger-system";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "view")) return forbidden();

  try {
    return ok(await getFingerSettingsPublic());
  } catch (e) {
    return serverError("No fue posible cargar la configuración de Finger System.", e);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "admin")) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    const updated = await updateFingerSettings({
      attReadOnly: typeof body.attReadOnly === "boolean" ? body.attReadOnly : undefined,
      syncAutoEnabled: typeof body.syncAutoEnabled === "boolean" ? body.syncAutoEnabled : undefined,
      syncIntervalMinutes:
        typeof body.syncIntervalMinutes === "number" ? body.syncIntervalMinutes : undefined,
      backupPath: body.backupPath !== undefined ? String(body.backupPath) : undefined,
      attSmbShare: body.attSmbShare !== undefined ? String(body.attSmbShare) : undefined,
      attDatabaseName: body.attDatabaseName !== undefined ? String(body.attDatabaseName) : undefined,
      discoveryDefaultPort:
        typeof body.discoveryDefaultPort === "number" ? body.discoveryDefaultPort : undefined,
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof Error) return badRequest(e.message);
    return serverError("No fue posible actualizar la configuración.", e);
  }
}
