import type { SyntraAiConfig } from "./syntra-ai-config";

const HTTP_TIMEOUT_MS = 55_000;

function llmHeaders(cfg: SyntraAiConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (compatible; SyntraAI/1.0; +https://one.grupocorporativoalfa.com) AlfaOne-Syntra-Assistant",
  };
  if (cfg.provider === "openrouter" || cfg.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://one.grupocorporativoalfa.com";
    headers.Referer = "https://one.grupocorporativoalfa.com";
    headers["X-Title"] = "Syntra AI Assistant Alfa One";
  }
  return headers;
}

function formatHttpError(code: number, detail: string, model: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes("insufficient_quota") || lower.includes("no credits remaining")) {
    return `La cuenta no tiene créditos (HTTP ${code}). Recargue o cambie el proveedor en SYNTra_AI_*.\n${detail.slice(0, 400)}`;
  }
  if (lower.includes("1010") || lower.includes("cloudflare")) {
    return `El proveedor bloqueó la petición (Cloudflare ${code}).\n${detail.slice(0, 400)}`;
  }
  return `Error del proveedor IA (${code}, modelo ${model || "n/d"}). Revise URL, modelo y API key.\n${detail.slice(0, 500)}`;
}

export async function callSyntraAiLlm(
  cfg: SyntraAiConfig,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: llmHeaders(cfg),
      body: JSON.stringify({ model: cfg.model, messages }),
      signal: controller.signal,
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(formatHttpError(res.status, raw, cfg.model));
    }

    const payload = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Respuesta vacía del proveedor IA.");
    return reply;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al contactar al proveedor IA.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
