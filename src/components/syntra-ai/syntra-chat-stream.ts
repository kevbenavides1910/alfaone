export type SyntraChatStreamResult = {
  reply: string;
  sessionId: string;
  sessionName?: string;
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) data = line.slice(6);
  }
  if (!data) return null;
  return { event, data };
}

export async function consumeSyntraChatStream(
  payload: Record<string, unknown>,
  onProgress: (text: string) => void,
): Promise<SyntraChatStreamResult> {
  const res = await fetch("/api/syntra-ai/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.body) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json.error?.message || "Sin respuesta del asistente");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: SyntraChatStreamResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (!parsed) continue;
      const json = JSON.parse(parsed.data) as Record<string, unknown>;
      if (parsed.event === "progress" && typeof json.text === "string") {
        onProgress(json.text);
      } else if (parsed.event === "done") {
        const data = json.data as SyntraChatStreamResult | undefined;
        if (data?.reply) result = data;
      } else if (parsed.event === "error") {
        throw new Error(typeof json.message === "string" ? json.message : "Error en el asistente");
      }
    }
  }

  if (!result?.reply) {
    throw new Error("Respuesta incompleta del asistente");
  }
  return result;
}
