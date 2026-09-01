import { prisma } from "@/modules/core/db/prisma";
import type { Session } from "next-auth";
import {
  applyTaskModelRoute,
  getSyntraAiConfig,
} from "./syntra-ai-config";
import { callSyntraAiLlm, type LlmMessage } from "./syntra-ai-llm";
import { runSyntraAgent } from "./syntra-ai-agent";
import { AGENT_TOOLS_PROMPT, describeAgentProgress } from "./syntra-ai-tools";
import { loadSyntraAiKnowledge } from "./syntra-ai-knowledge";
import {
  buildMemoryAndSkillsPrompt,
  tryHandleMemoryCommands,
} from "./syntra-ai-memory";
import {
  buildPageContextPrompt,
  type SyntraAiPageContext,
} from "../business/page-context";
import {
  buildUserMessageWithUploads,
  prepareChatUploads,
  type ChatUploadInput,
} from "./syntra-ai-uploads";

const MAX_MESSAGE_LEN = 4000;
const MAX_HISTORY_TURNS = 10;

const SYSTEM_PROMPT = `Eres Syntra, asistente de Alfa One (plataforma de contratos, gastos, facturación, nómina NAF y operaciones de Grupo Alfa).
Ayudas con procedimientos, pantallas y buenas prácticas. Responde en español, claro y útil.
Cuando tengas herramientas de consulta, úsalas para responder con datos reales antes de dar solo instrucciones manuales.
No inventes cifras; si no hay datos sincronizados, dilo claramente.
Comandos del usuario:
- «recuerda para el equipo: …» → memoria compartida (todos los usuarios)
- «recuerda …» → memoria personal del usuario
- «olvida …» → archiva un hecho
- «aprende …» / /learn → skill de equipo; «solo para mí» → skill personal
`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type SyntraAiChatInput = {
  userId: string;
  session: Session;
  message: string;
  history?: ChatTurn[];
  sessionId?: string | null;
  pageContext?: SyntraAiPageContext | null;
  uploads?: ChatUploadInput[];
  onProgress?: (text: string) => void;
};

export type SyntraAiChatResult = {
  reply: string;
  sessionId: string;
  sessionName: string;
  pageLabel?: string;
  modelUsed?: string;
  uploadErrors?: string[];
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
  let cfg = await getSyntraAiConfig();
  if (!cfg.enabled) {
    throw new Error("El asistente IA está deshabilitado. Actívelo en Mantenimiento → Syntra IA.");
  }
  if (!cfg.apiKey) {
    throw new Error("Falta configurar la API Key en Mantenimiento → Syntra IA.");
  }

  const uploadCtx = prepareChatUploads(input.uploads);
  const msg = (input.message || "").trim();
  if (!msg && !uploadCtx.accepted) {
    if (uploadCtx.errors.length) throw new Error(uploadCtx.errors.join("\n"));
    throw new Error("Escriba una pregunta o adjunte un archivo.");
  }
  if (msg.length > MAX_MESSAGE_LEN) throw new Error("El mensaje es demasiado largo.");

  cfg = applyTaskModelRoute(cfg, uploadCtx);
  if (uploadCtx.imageCount > 0 && cfg.routeVisionAuto && !cfg.modelVision && !cfg.model.includes("mimo")) {
    throw new Error(
      "Hay imágenes adjuntas pero no hay modelo de visión configurado. Configúrelo en Mantenimiento → Syntra IA.",
    );
  }

  const historyLabel = msg || `[Adjuntos: ${uploadCtx.labels.join(", ")}]`;

  const memoryReply = msg ? await tryHandleMemoryCommands(input.userId, msg) : null;
  if (memoryReply) {
    const saved = await appendTurn(
      input.userId,
      input.sessionId,
      historyLabel,
      memoryReply,
      input.pageContext?.path,
    );
    return { reply: memoryReply, ...saved, uploadErrors: uploadCtx.errors };
  }

  const [knowledge, memoryPrompt] = await Promise.all([
    Promise.resolve(loadSyntraAiKnowledge()),
    buildMemoryAndSkillsPrompt(input.userId),
  ]);

  const systemParts = [SYSTEM_PROMPT];
  if (knowledge) systemParts.push(`## Conocimiento interno\n${knowledge}`);
  if (memoryPrompt) systemParts.push(memoryPrompt);
  const pagePrompt = buildPageContextPrompt(input.pageContext);
  if (pagePrompt) systemParts.push(pagePrompt);
  if (uploadCtx.prompt) systemParts.push(uploadCtx.prompt);
  if (cfg.agentEnabled && uploadCtx.imageCount === 0) systemParts.push(AGENT_TOOLS_PROMPT);

  const messages: LlmMessage[] = [{ role: "system", content: systemParts.join("\n\n") }];

  const history = (input.history || []).slice(-MAX_HISTORY_TURNS * 2);
  for (const turn of history) {
    if (turn.role === "user" || turn.role === "assistant") {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  messages.push(buildUserMessageWithUploads(msg, uploadCtx) as LlmMessage);

  let reply: string;
  let modelUsed = cfg.model;

  if (cfg.agentEnabled && uploadCtx.imageCount === 0) {
    const agentResult = await runSyntraAgent({
      cfg,
      session: input.session,
      messages,
      maxRounds: cfg.agentMaxRounds,
      onProgress: input.onProgress,
    });
    reply = agentResult.reply;
    modelUsed = agentResult.modelUsed;
  } else {
    input.onProgress?.(describeAgentProgress("model"));
    reply = await callSyntraAiLlm(cfg, messages);
  }

  const saved = await appendTurn(input.userId, input.sessionId, historyLabel, reply, input.pageContext?.path);
  return {
    reply,
    ...saved,
    pageLabel: input.pageContext?.path,
    modelUsed,
    uploadErrors: uploadCtx.errors.length ? uploadCtx.errors : undefined,
  };
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
