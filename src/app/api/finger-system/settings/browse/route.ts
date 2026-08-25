import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { listAtt2016ShareFiles } from "@/modules/finger-system/integrations/att2016/smb-client";

type BrowseBody = {
  share?: string;
  attSmbUser?: string;
  attSmbPassword?: string;
};

async function browseShare(body: BrowseBody, shareFromQuery?: string | null) {
  const share = body.share?.trim() || shareFromQuery?.trim() || undefined;
  return listAtt2016ShareFiles(share, {
    user: body.attSmbUser,
    password: body.attSmbPassword,
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "admin")) return forbidden();

  try {
    const share = req.nextUrl.searchParams.get("share");
    return ok(await listAtt2016ShareFiles(share ?? undefined));
  } catch (e) {
    if (e instanceof Error) return badRequest(e.message);
    return serverError("No fue posible explorar el share SMB.", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "admin")) return forbidden();

  try {
    const body = (await req.json().catch(() => ({}))) as BrowseBody;
    return ok(await browseShare(body));
  } catch (e) {
    if (e instanceof Error) return badRequest(e.message);
    return serverError("No fue posible explorar el share SMB.", e);
  }
}
