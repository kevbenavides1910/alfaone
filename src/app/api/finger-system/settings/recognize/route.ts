import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { recognizeAtt2016Database } from "@/modules/finger-system/services/finger-att2016-recognize";
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
      const resolved = resolveAttDatabasePath(body.attWindowsPath, settings.attDriveMappings);
      sharePath = resolved.smbShare;
      databaseName = resolved.databaseName;
    }

    return ok(await recognizeAtt2016Database({ sharePath, databaseName }));
  } catch (e) {
    return serverError("No fue posible reconocer la base ATT2016.", e);
  }
}
