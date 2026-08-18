import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { listAtt2016ShareFiles } from "@/modules/finger-system/integrations/att2016/smb-client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "admin")) return forbidden();

  try {
    const share = req.nextUrl.searchParams.get("share") ?? undefined;
    return ok(await listAtt2016ShareFiles(share));
  } catch (e) {
    if (e instanceof Error) return badRequest(e.message);
    return serverError("No fue posible explorar el share SMB.", e);
  }
}
