export const OPENCODE_GO_BASE = "https://opencode.ai/zen/go/v1";
export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
export const OPENAI_BASE = "https://api.openai.com/v1";

export const OPENCODE_GO_MODELS: Array<{ id: string; label: string }> = [
  { id: "kimi-k2.7-code", label: "Kimi K2.7 Code (recomendado)" },
  { id: "kimi-k3", label: "Kimi K3" },
  { id: "kimi-k2.6", label: "Kimi K2.6" },
  { id: "kimi-k2.5", label: "Kimi K2.5" },
  { id: "glm-5.3", label: "GLM 5.3" },
  { id: "glm-5.2", label: "GLM 5.2" },
  { id: "mimo-v2.5-pro", label: "MiMo V2.5 Pro" },
  { id: "mimo-v2.5", label: "MiMo V2.5 (visión)" },
  { id: "mimo-v2-omni", label: "MiMo V2 Omni" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
];

export const OPENCODE_VISION_MODELS = new Set([
  "mimo-v2.5",
  "mimo-v2-omni",
  "kimi-k2.7-code",
  "kimi-k2.6",
  "kimi-k2.5",
  "kimi-k3",
]);

export const SYNTra_AI_PROVIDERS = [
  { id: "opencode_go", label: "OpenCode Go" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "openai", label: "OpenAI" },
] as const;

export type SyntraAiProvider = (typeof SYNTra_AI_PROVIDERS)[number]["id"];

export function defaultBaseUrl(provider: string): string {
  if (provider === "openrouter") return OPENROUTER_BASE;
  if (provider === "openai") return OPENAI_BASE;
  return OPENCODE_GO_BASE;
}

export function modelSupportsVision(model: string): boolean {
  const m = model.toLowerCase();
  if (OPENCODE_VISION_MODELS.has(m)) return true;
  return ["gpt-4o", "gpt-4.1", "gpt-5", "gemini", "claude", "vision", "omni", "pixtral"].some(
    (n) => m.includes(n),
  );
}
