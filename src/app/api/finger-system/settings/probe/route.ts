import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { probeAtt2016Connection } from "@/modules/finger-system/integrations/att2016/adapter";
import { resolveAttDatabasePath } from "@/modules/finger-system/integrations/att2016/path-resolver";
import { ensureFingerSettingsRow } from "@/modules/finger-system/services/finger-settings";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "admin")) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    const settings = await ensureFingerSettingsRow();

    let sharePath = typeof body.attSmbShare === "string" ? body.attSmbShare : undefined;
    let databaseName = typeof body.attDatabaseName === "string" ? body.attDatabaseName : undefined;

    if (typeof body.attWindowsPath === "string" && body.attWindowsPath.trim()) {
      const mappings =
        Array.isArray(body.attDriveMappings) && body.attDriveMappings.length > 0
          ? body.attDriveMappings
          : settings.attDriveMappings;
      const resolved = resolveAttDatabasePath(body.attWindowsPath, mappings);
      sharePath = resolved.smbShare;
      databaseName = resolved.databaseName;
    }

    const result = await probeAtt2016Connection({
      sharePath,
      databaseName,
      smbUser: typeof body.attSmbUser === "string" ? body.attSmbUser : undefined,
      smbPassword: typeof body.attSmbPassword === "string" ? body.attSmbPassword : undefined,
    });
    return ok({
      ...result,
      reachable: result.reachable,
      windowsPath: body.attWindowsPath ?? null,
      resolvedShare: sharePath ?? null,
      resolvedDatabase: databaseName ?? null,
    });
  } catch (e) {
    if (e instanceof Error) return ok({ reachable: false, configured: true, message: e.message });
    return serverError("No fue posible probar la conexión ATT2016.", e);
  }
}
