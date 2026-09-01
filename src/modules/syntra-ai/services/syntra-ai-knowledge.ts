import fs from "node:fs";
import path from "node:path";

const KNOWLEDGE_MAX_CHARS = 12_000;

export function loadSyntraAiKnowledge(): string {
  const dir = path.join(process.cwd(), "src/modules/syntra-ai/knowledge");
  if (!fs.existsSync(dir)) return "";

  const parts: string[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".md")) continue;
    try {
      parts.push(fs.readFileSync(path.join(dir, name), "utf-8"));
    } catch {
      // ignore unreadable files
    }
  }

  let text = parts.join("\n\n---\n\n");
  if (text.length > KNOWLEDGE_MAX_CHARS) {
    text = `${text.slice(0, KNOWLEDGE_MAX_CHARS)}\n\n[... contenido truncado ...]`;
  }
  return text;
}
