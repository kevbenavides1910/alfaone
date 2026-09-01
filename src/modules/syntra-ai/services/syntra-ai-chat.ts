import { prisma } from "@/modules/core/db/prisma";
import { getSyntraAiConfig } from "./syntra-ai-config";
import { callSyntraAiLlm } from "./syntra-ai-llm";
import { loadSyntraAiKnowledge } from "./syntra-ai-knowledge";
import {
  buildMemoryAndSkillsPrompt,
  tryHandleMemoryCommands,
} from "./syntra-ai-memory";

const MAX_MESSAGE_LEN = 4000;
const MAX_HISTORY_TURNS = 10;

const SYSTEM_PROMPT = `Eres Syntra, asistente de Alfa One (plataforma de contratos, gastos, facturación, nómina NAF y operaciones de Grupo Alfa).
Ayudas con procedimientos, pantallas y buenas prácticas. Responde en español, claro y útil.
No inventes datos de negocio; si no tienes contexto, dilo y sugiere dónde consultar en la app.
Comandos del usuario:
- «recuerda …» / «olvida …» → memoria persistente
- «aprende …» / /learn → skills de procedimiento
`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type SyntraAiChatInput = {
  userId: string;
  message: string;
  history?: ChatTurn[];
  sessionId?: string | null;
  pagePath?: string | null;
};

export type SyntraAiChatResult = {
  reply: string;
  sessionId: string;
  sessionName: string;
};

async function appendTurn(
  userId: string,
  sessionId: string | null | undefined,
  userContent: string,
  assistantContent: string,
  pagePath?: string | null,
): Promise<{ sessionId: string; sessionName: string }> {
  let session = sessionId
    ? await prisma.syntraAiChatSession.findFirst({
        where: { id: sessionId, userId, active: true },
      })
    : null;

  if (!session) {
    const title = userContent.trim().replace(/\n/g, " ").slice(0, 80) || "Nueva conversación";
    session = await prisma.syntraAiChatSession.create({
      data: { userId, name: title, pagePath: pagePath || null },
    });
  } else if (
    (session.name === "Nueva conversación" || session.name === "Nueva chat") &&
    userContent.trim()
  ) {
    session = await prisma.syntraAiChatSession.update({
      where: { id: session.id },
      data: { name: userContent.trim().replace(/\n/g, " ").slice(0, 80) },
    });
  }

  const lastSeq = await prisma.syntraAiChatMessage.aggregate({
    where: { sessionId: session.id },
    _max: { sequence: true },
  });
  const seq = (lastSeq._max.sequence ?? 0) + 1;

  await prisma.syntraAiChatMessage.createMany({
    data: [
      { sessionId: session.id, role: "user", content: userContent, sequence: seq },
      { sessionId: session.id, role: "assistant", content: assistantContent, sequence: seq + 1 },
    ],
  });

  await prisma.syntraAiChatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return { sessionId: session.id, sessionName: session.name };
}

export async function syntraAiChat(input: SyntraAiChatInput): Promise<SyntraAiChatResult> {
  const cfg = await getSyntraAiConfig();
  if (!cfg.enabled) {
    throw new Error("El asistente IA está deshabilitado. Configure SYNTra_AI_ENABLED=true.");
  }
  if (!cfg.apiKey) {
    throw new Error("Falta configurar SYNTra_AI_API_KEY.");
  }

  const msg = (input.message || "").trim();
  if (!msg) throw new Error("Escriba una pregunta.");
  if (msg.length > MAX_MESSAGE_LEN) throw new Error("El mensaje es demasiado largo.");

  const memoryReply = await tryHandleMemoryCommands(input.userId, msg);
  if (memoryReply) {
    const saved = await appendTurn(
      input.userId,
      input.sessionId,
      msg,
      memoryReply,
      input.pagePath,
    );
    return { reply: memoryReply, ...saved };
  }

  const [knowledge, memoryPrompt] = await Promise.all([
    Promise.resolve(loadSyntraAiKnowledge()),
    buildMemoryAndSkillsPrompt(input.userId),
  ]);

  const systemParts = [SYSTEM_PROMPT];
  if (knowledge) systemParts.push(`## Conocimiento interno\n${knowledge}`);
  if (memoryPrompt) systemParts.push(memoryPrompt);
  if (input.pagePath) systemParts.push(`Pantalla actual del usuario: ${input.pagePath}`);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemParts.join("\n\n") },
  ];

  const history = (input.history || []).slice(-MAX_HISTORY_TURNS * 2);
  for (const turn of history) {
    if (turn.role === "user" || turn.role === "assistant") {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  messages.push({ role: "user", content: msg });

  const reply = await callSyntraAiLlm(cfg, messages);
  const saved = await appendTurn(input.userId, input.sessionId, msg, reply, input.pagePath);
  return { reply, ...saved };
}

export async function listSyntraAiSessions(userId: string, limit = 40) {
  const sessions = await prisma.syntraAiChatSession.findMany({
    where: { userId, active: true },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit, 100),
    include: { _count: { select: { messages: true } } },
  });
  return sessions.map((s) => ({
    id: s.id,
    name: s.name,
    pagePath: s.pagePath,
    messageCount: s._count.messages,
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function getSyntraAiSession(userId: string, sessionId: string) {
  const session = await prisma.syntraAiChatSession.findFirst({
    where: { id: sessionId, userId, active: true },
    include: { messages: { orderBy: { sequence: "asc" } } },
  });
  if (!session) return null;
  return {
    session: {
      id: session.id,
      name: session.name,
      pagePath: session.pagePath,
    },
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
