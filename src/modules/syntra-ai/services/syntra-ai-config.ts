import { prisma } from "@/modules/core/db/prisma";

export type SyntraAiProvider = "opencode_go" | "openrouter" | "openai";

export type SyntraAiConfig = {
  enabled: boolean;
  provider: SyntraAiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
};

function resolveProvider(raw: string | null | undefined): SyntraAiProvider {
  if (raw === "openrouter" || raw === "openai") return raw;
  return "opencode_go";
}

function resolveBaseUrl(provider: SyntraAiProvider, baseUrl: string | null | undefined): string {
  const trimmed = (baseUrl || "").trim();
  if (provider === "openrouter") return trimmed || "https://openrouter.ai/api/v1";
  if (provider === "openai") return trimmed || "https://api.openai.com/v1";
  return trimmed || "https://opencode.ai/zen/go/v1";
}

function resolveModel(provider: SyntraAiProvider, model: string | null | undefined): string {
  const m = (model || "").trim();
  if (m) return m.replace(/^opencode-go\//, "");
  if (provider === "openrouter") return "openai/gpt-4o-mini";
  if (provider === "openai") return "gpt-4o-mini";
  return "kimi-k2.7-code";
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  return v === "true" || v === "1";
}

function envStr(...names: string[]): string {
  for (const name of names) {
    const v = (process.env[name] || "").trim();
    if (v) return v;
  }
  return "";
}

export async function getSyntraAiConfig(): Promise<SyntraAiConfig> {
  const row = await prisma.syntraAiSettings.findUnique({ where: { id: "default" } });

  const enabled =
    envFlag("SYNTra_AI_ENABLED") ||
    envFlag("SYNTRA_AI_ENABLED") ||
    Boolean(row?.enabled);

  const provider = resolveProvider(
    envStr("SYNTra_AI_PROVIDER", "SYNTRA_AI_PROVIDER") || row?.provider,
  );
  const apiKey = envStr("SYNTra_AI_API_KEY", "SYNTRA_AI_API_KEY") || (row?.apiKey || "").trim();
  const baseUrl = resolveBaseUrl(
    provider,
    envStr("SYNTra_AI_BASE_URL", "SYNTRA_AI_BASE_URL") || row?.baseUrl,
  );
  const model = resolveModel(
    provider,
    envStr("SYNTra_AI_MODEL", "SYNTRA_AI_MODEL") || row?.model,
  );

  return { enabled, provider, baseUrl, apiKey, model };
}

/** Copia credenciales desde Odoo (ir_config_parameter) a syntra_ai_settings. */
export async function syncSyntraAiSettingsFromOdoo(params: {
  enabled: boolean;
  provider: string;
  baseUrl: string | null;
  apiKey: string;
  model: string;
}): Promise<void> {
  await prisma.syntraAiSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled: params.enabled,
      provider: params.provider || "opencode_go",
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: params.model || "kimi-k2.7-code",
    },
    update: {
      enabled: params.enabled,
      provider: params.provider || "opencode_go",
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: params.model || "kimi-k2.7-code",
    },
  });
}
