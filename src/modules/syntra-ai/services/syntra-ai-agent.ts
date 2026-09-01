import type { Session } from "next-auth";
import type { SyntraAiConfig } from "./syntra-ai-config";
import {
  callSyntraAiLlm,
  callSyntraAiLlmMessage,
  type LlmMessage,
  type LlmToolCall,
} from "./syntra-ai-llm";
import { executeSyntraTool, describeAgentProgress, getSyntraToolDefinitions, type ToolDefinition } from "./syntra-ai-tools";

export type RunSyntraAgentInput = {
  cfg: SyntraAiConfig;
  session: Session;
  messages: LlmMessage[];
  maxRounds?: number;
  onProgress?: (text: string) => void;
};

export type RunSyntraAgentResult = {
  reply: string;
  modelUsed: string;
  toolRounds: number;
};

function messageText(content: LlmMessage["content"]): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("\n")
      .trim();
  }
  return "";
}

export async function runSyntraAgent(input: RunSyntraAgentInput): Promise<RunSyntraAgentResult> {
  const emit = (text: string) => input.onProgress?.(text);
  const tools = getSyntraToolDefinitions(input.session);
  if (!tools.length) {
    emit(describeAgentProgress("model"));
    const reply = await callSyntraAiLlm(input.cfg, input.messages);
    return { reply, modelUsed: input.cfg.model, toolRounds: 0 };
  }

  emit(describeAgentProgress("start"));
  const maxRounds = Math.min(Math.max(input.maxRounds ?? input.cfg.agentMaxRounds ?? 6, 1), 10);
  const working: LlmMessage[] = [...input.messages];

  for (let round = 0; round < maxRounds; round += 1) {
    emit(describeAgentProgress("llm", { round }));
    const msg = await callSyntraAiLlmMessage(input.cfg, working, tools);
    const toolCalls: LlmToolCall[] = msg.tool_calls ?? [];

    if (!toolCalls.length) {
      emit(describeAgentProgress("compose"));
      const text = messageText(msg.content);
      if (!text) throw new Error("Respuesta vacía del proveedor IA.");
      return { reply: text, modelUsed: input.cfg.model, toolRounds: round };
    }

    working.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      emit(describeAgentProgress("tool", { toolName: call.function.name, args }));
      const result = await executeSyntraTool(input.session, call.function.name, args);
      working.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error(
    "Consulté varias fuentes pero no pude cerrar la respuesta. Reformule la pregunta o acótese a un periodo concreto.",
  );
}

export { getSyntraToolDefinitions, type ToolDefinition };
