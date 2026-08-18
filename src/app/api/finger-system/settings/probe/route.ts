import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { probeAtt2016Connection } from "@/modules/finger-system/integrations/att2016/adapter";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "view")) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    const result = await probeAtt2016Connection({
      sharePath: typeof body.attSmbShare === "string" ? body.attSmbShare : undefined,
      databaseName: typeof body.attDatabaseName === "string" ? body.attDatabaseName : undefined,
    });
    return ok(result);
  } catch (e) {
    return serverError("No fue posible probar la conexión ATT2016.", e);
  }
}
