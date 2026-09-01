import type { SyntraAiConfig } from "./syntra-ai-config";
import type { ToolDefinition } from "./syntra-ai-tools";

const HTTP_TIMEOUT_MS = 55_000;

export type LlmMessageContent =
  | string
  | null
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;

export type LlmToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type LlmMessage = {
  role: string;
  content?: LlmMessageContent;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
};

export type LlmAssistantMessage = {
  role: "assistant";
  content: LlmMessageContent;
  tool_calls?: LlmToolCall[];
};

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
    return `La cuenta no tiene créditos (HTTP ${code}). Recargue o cambie el proveedor en Mantenimiento → Syntra IA.\n${detail.slice(0, 400)}`;
  }
  if (lower.includes("1010") || lower.includes("cloudflare")) {
    return `El proveedor bloqueó la petición (Cloudflare ${code}).\n${detail.slice(0, 400)}`;
  }
  return `Error del proveedor IA (${code}, modelo ${model || "n/d"}). Revise URL, modelo y API key.\n${detail.slice(0, 500)}`;
}

async function postChatCompletions(
  cfg: SyntraAiConfig,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: llmHeaders(cfg),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(formatHttpError(res.status, raw, cfg.model));
    }

    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al contactar al proveedor IA.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parseAssistantMessage(payload: Record<string, unknown>): LlmAssistantMessage {
  const choices = payload.choices as Array<{ message?: LlmAssistantMessage }> | undefined;
  const message = choices?.[0]?.message;
  if (!message) throw new Error("El proveedor no devolvió respuesta. Revise el modelo y cuotas.");
  return message;
}

export async function callSyntraAiLlmMessage(
  cfg: SyntraAiConfig,
  messages: LlmMessage[],
  tools?: ToolDefinition[],
): Promise<LlmAssistantMessage> {
  const body: Record<string, unknown> = { model: cfg.model, messages };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const payload = await postChatCompletions(cfg, body);
  return parseAssistantMessage(payload);
}

export async function callSyntraAiLlm(cfg: SyntraAiConfig, messages: LlmMessage[]): Promise<string> {
  const msg = await callSyntraAiLlmMessage(cfg, messages);
  const content = msg.content;
  const text =
    typeof content === "string"
      ? content.trim()
      : Array.isArray(content)
        ? content
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text!)
            .join("\n")
            .trim()
        : "";
  if (!text && !(msg.tool_calls?.length)) {
    throw new Error("Respuesta vacía del proveedor IA.");
  }
  if (!text) throw new Error("El modelo devolvió solo llamadas a herramientas sin texto final.");
  return text;
}
