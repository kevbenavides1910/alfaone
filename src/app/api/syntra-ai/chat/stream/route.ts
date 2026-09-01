import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { unauthorized, badRequest } from "@/lib/api/response";
import { syntraAiChat, type SyntraAiChatResult } from "@/modules/syntra-ai";

const uploadSchema = z.object({
  name: z.string().optional(),
  mimetype: z.string().optional(),
  data: z.string().optional(),
});

const pageContextSchema = z.object({
  path: z.string(),
  pageTitle: z.string().nullable().optional(),
  moduleLabel: z.string().nullable().optional(),
});

const chatSchema = z.object({
  message: z.string().max(4000).default(""),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  sessionId: z.string().optional().nullable(),
  pageContext: pageContextSchema.optional().nullable(),
  pagePath: z.string().optional().nullable(),
  uploads: z.array(uploadSchema).optional(),
});

function isClientError(msg: string) {
  return (
    msg.includes("deshabilitado") ||
    msg.includes("API key") ||
    msg.includes("API Key") ||
    msg.includes("Escriba") ||
    msg.includes("adjunte")
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  const pageContext =
    parsed.data.pageContext ??
    (parsed.data.pagePath
      ? { path: parsed.data.pagePath, pageTitle: null, moduleLabel: null }
      : null);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result: SyntraAiChatResult = await syntraAiChat({
          userId: session.user.id,
          session,
          message: parsed.data.message,
          history: parsed.data.history,
          sessionId: parsed.data.sessionId,
          pageContext,
          uploads: parsed.data.uploads,
          onProgress: (text) => send("progress", { text }),
        });
        send("done", { data: result });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error en el asistente IA";
        send("error", { message: msg, clientError: isClientError(msg) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
