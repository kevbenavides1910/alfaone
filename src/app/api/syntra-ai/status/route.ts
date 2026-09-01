import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized } from "@/lib/api/response";
import { getSyntraAiConfig } from "@/modules/syntra-ai";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const cfg = await getSyntraAiConfig();
  return ok({
    enabled: cfg.enabled && Boolean(cfg.apiKey),
    model: cfg.model,
    provider: cfg.provider,
  });
}
