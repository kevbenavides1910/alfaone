import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { FeIncomingMailService } from "@/modules/facturacion-electronica/services/incoming/incoming-mail.service";

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  try {
    const incoming = new FeIncomingMailService(prisma);
    const results = await incoming.pollAllEmpresas();
    return ok({ results });
  } catch (e) {
    return serverError("Error sincronizando buzones IMAP", e);
  }
}
