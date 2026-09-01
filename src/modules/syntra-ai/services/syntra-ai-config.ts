import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import {
  defaultBaseUrl,
  modelSupportsVision,
  OPENCODE_GO_MODELS,
  SYNTra_AI_PROVIDERS,
  type SyntraAiProvider,
} from "../business/syntra-ai-models";
import { callSyntraAiLlm } from "./syntra-ai-llm";

export type SyntraAiConfig = {
  enabled: boolean;
  provider: SyntraAiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelVision: string;
  routeVisionAuto: boolean;
  modelDocuments: string | null;
  agentEnabled: boolean;
  agentMaxRounds: number;
};

export type SyntraAiSettingsPublic = {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  modelVision: string;
  routeVisionAuto: boolean;
  modelDocuments: string | null;
  agentEnabled: boolean;
  agentMaxRounds: number;
  hasApiKey: boolean;
  apiKeyHint: string | null;
};

const settingsUpdateSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["opencode_go", "openrouter", "openai"]),
  baseUrl: z.string().max(500).nullable().optional(),
  apiKey: z.string().max(500).optional(),
  model: z.string().min(1).max(120),
  modelVision: z.string().min(1).max(120),
  routeVisionAuto: z.boolean(),
  modelDocuments: z.string().max(120).nullable().optional(),
  agentEnabled: z.boolean().optional(),
  agentMaxRounds: z.number().int().min(1).max(10).optional(),
});

function resolveProvider(raw: string | null | undefined): SyntraAiProvider {
  if (raw === "openrouter" || raw === "openai") return raw;
  return "opencode_go";
}

function resolveBaseUrl(provider: SyntraAiProvider, baseUrl: string | null | undefined): string {
  const trimmed = (baseUrl || "").trim();
  return trimmed || defaultBaseUrl(provider);
}

function resolveModel(provider: SyntraAiProvider, model: string | null | undefined): string {
  const m = (model || "").trim().replace(/^opencode-go\//, "");
  if (m) return m;
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

function rowToConfig(row: {
  enabled: boolean;
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  modelVision: string;
  routeVisionAuto: boolean;
  modelDocuments: string | null;
  agentEnabled: boolean;
  agentMaxRounds: number;
}): SyntraAiConfig {
  const provider = resolveProvider(row.provider);
  return {
    enabled: row.enabled,
    provider,
    baseUrl: resolveBaseUrl(provider, row.baseUrl),
    apiKey: (row.apiKey || "").trim(),
    model: resolveModel(provider, row.model),
    modelVision: resolveModel(provider, row.modelVision || "mimo-v2.5"),
    routeVisionAuto: row.routeVisionAuto,
    modelDocuments: row.modelDocuments?.trim() || null,
    agentEnabled: row.agentEnabled ?? true,
    agentMaxRounds: row.agentMaxRounds ?? 6,
  };
}

export async function getSyntraAiConfig(): Promise<SyntraAiConfig> {
  let row = await prisma.syntraAiSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.syntraAiSettings.create({
      data: { id: "default", enabled: false },
    });
  }

  const envEnabled = envFlag("SYNTra_AI_ENABLED") || envFlag("SYNTRA_AI_ENABLED");
  const envApiKey = envStr("SYNTra_AI_API_KEY", "SYNTRA_AI_API_KEY");

  const cfg = rowToConfig(row);
  if (envEnabled) cfg.enabled = true;
  if (envApiKey) cfg.apiKey = envApiKey;
  if (envStr("SYNTra_AI_PROVIDER", "SYNTRA_AI_PROVIDER")) {
    cfg.provider = resolveProvider(envStr("SYNTra_AI_PROVIDER", "SYNTRA_AI_PROVIDER"));
  }
  if (envStr("SYNTra_AI_BASE_URL", "SYNTRA_AI_BASE_URL")) {
    cfg.baseUrl = resolveBaseUrl(cfg.provider, envStr("SYNTra_AI_BASE_URL", "SYNTRA_AI_BASE_URL"));
  }
  if (envStr("SYNTra_AI_MODEL", "SYNTRA_AI_MODEL")) {
    cfg.model = resolveModel(cfg.provider, envStr("SYNTra_AI_MODEL", "SYNTRA_AI_MODEL"));
  }
  return cfg;
}

export function applyTaskModelRoute(
  cfg: SyntraAiConfig,
  uploadCtx: { imageCount: number; docCount: number },
): SyntraAiConfig {
  const next = { ...cfg };
  if (uploadCtx.imageCount > 0 && cfg.routeVisionAuto) {
    if (!modelSupportsVision(cfg.model)) {
      if (cfg.modelVision) {
        next.model = cfg.modelVision;
      }
    }
  } else if (uploadCtx.docCount > 0 && cfg.modelDocuments) {
    next.model = cfg.modelDocuments;
  }
  return next;
}

export async function getSyntraAiSettingsPublic(): Promise<SyntraAiSettingsPublic> {
  const cfg = await getSyntraAiConfig();
  const key = cfg.apiKey;
  return {
    enabled: cfg.enabled,
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    modelVision: cfg.modelVision,
    routeVisionAuto: cfg.routeVisionAuto,
    modelDocuments: cfg.modelDocuments,
    agentEnabled: cfg.agentEnabled,
    agentMaxRounds: cfg.agentMaxRounds,
    hasApiKey: Boolean(key),
    apiKeyHint: key ? `••••${key.slice(-4)}` : null,
  };
}

export async function updateSyntraAiSettings(input: z.infer<typeof settingsUpdateSchema>) {
  const parsed = settingsUpdateSchema.parse(input);
  const existing = await prisma.syntraAiSettings.findUnique({ where: { id: "default" } });
  const apiKey =
    parsed.apiKey?.trim() ||
    existing?.apiKey ||
    envStr("SYNTra_AI_API_KEY", "SYNTRA_AI_API_KEY") ||
    null;

  await prisma.syntraAiSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled: parsed.enabled,
      provider: parsed.provider,
      baseUrl: parsed.baseUrl?.trim() || defaultBaseUrl(parsed.provider),
      apiKey,
      model: parsed.model,
      modelVision: parsed.modelVision,
      routeVisionAuto: parsed.routeVisionAuto,
      modelDocuments: parsed.modelDocuments?.trim() || null,
      agentEnabled: parsed.agentEnabled ?? true,
      agentMaxRounds: parsed.agentMaxRounds ?? 6,
    },
    update: {
      enabled: parsed.enabled,
      provider: parsed.provider,
      baseUrl: parsed.baseUrl?.trim() || defaultBaseUrl(parsed.provider),
      ...(parsed.apiKey?.trim() ? { apiKey: parsed.apiKey.trim() } : {}),
      model: parsed.model,
      modelVision: parsed.modelVision,
      routeVisionAuto: parsed.routeVisionAuto,
      modelDocuments: parsed.modelDocuments?.trim() || null,
      ...(parsed.agentEnabled !== undefined ? { agentEnabled: parsed.agentEnabled } : {}),
      ...(parsed.agentMaxRounds !== undefined ? { agentMaxRounds: parsed.agentMaxRounds } : {}),
    },
  });
  return getSyntraAiSettingsPublic();
}

export async function testSyntraAiConnection(overrides?: Partial<z.infer<typeof settingsUpdateSchema>>) {
  const current = await getSyntraAiConfig();
  const provider = resolveProvider(overrides?.provider || current.provider);
  const cfg: SyntraAiConfig = {
    enabled: true,
    provider,
    baseUrl: resolveBaseUrl(provider, overrides?.baseUrl ?? current.baseUrl),
    apiKey: overrides?.apiKey?.trim() || current.apiKey,
    model: resolveModel(provider, overrides?.model || current.model),
    modelVision: resolveModel(provider, overrides?.modelVision || current.modelVision),
    routeVisionAuto: overrides?.routeVisionAuto ?? current.routeVisionAuto,
    modelDocuments: overrides?.modelDocuments ?? current.modelDocuments,
  };
  if (!cfg.apiKey) throw new Error("Falta API key.");
  const reply = await callSyntraAiLlm(cfg, [
    { role: "system", content: "Responde solo con la palabra OK." },
    { role: "user", content: "ping" },
  ]);
  return { ok: true, message: `Conexión OK (${cfg.model}): ${reply.slice(0, 80)}` };
}

export { OPENCODE_GO_MODELS, SYNTra_AI_PROVIDERS, settingsUpdateSchema };
export type { SyntraAiProvider } from "../business/syntra-ai-models";
