import { NextRequest } from "next/server";
import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { pruneAllGpsTracks } from "@/modules/syntra/services/patrol-live-tracking-service";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.SYNTRA_CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return req.nextUrl.searchParams.get("secret") === secret;
}

async function runPurge() {
  const deleted = await pruneAllGpsTracks();
  return ok({ deleted, cutoffDays: 62 });
}

const adminPurgeHandler = withPermission(async () => {
  try {
    return await runPurge();
  } catch (e) {
    return serverError("Error al purgar historial GPS", e);
  }
}, "recorridos.configuracion", "edit");

/** Purga diaria de puntos GPS antiguos (cron con SYNTRA_CRON_SECRET / Alfa One). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Record<string, never>> },
) {
  if (isCronAuthorized(req)) {
    try {
      return await runPurge();
    } catch (e) {
      return serverError("Error al purgar historial GPS", e);
    }
  }
  return adminPurgeHandler(req, ctx);
}
