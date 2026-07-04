import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { FeJobRunner } from "@/modules/facturacion-electronica/jobs/fe-job-runner";
import { FeIncomingMailService } from "@/modules/facturacion-electronica/services/incoming/incoming-mail.service";
import { feLogger } from "@/modules/facturacion-electronica/utils/logger";

async function runFeJobs() {
  const runner = new FeJobRunner(prisma);
  const summary = await runner.runDueJobs("fe-cron");

  let imap: Awaited<ReturnType<FeIncomingMailService["pollAllEmpresas"]>> = [];
  try {
    const incoming = new FeIncomingMailService(prisma);
    imap = await incoming.pollAllEmpresas();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    feLogger.error("IMAP poll en cron FE falló", { error: message });
    imap = [{ companyCode: "*", error: message, processed: 0, skipped: 0 }];
  }

  return { ...summary, imap };
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  try {
    const summary = await runFeJobs();
    return ok(summary);
  } catch (e) {
    return serverError("Error ejecutando jobs FE", e);
  }
}
