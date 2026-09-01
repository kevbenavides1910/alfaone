import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api/response";
import { syntraAiChat } from "@/modules/syntra-ai";

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

  try {
    const result = await syntraAiChat({
      userId: session.user.id,
      session,
      message: parsed.data.message,
      history: parsed.data.history,
      sessionId: parsed.data.sessionId,
      pageContext,
      uploads: parsed.data.uploads,
    });
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en el asistente IA";
    if (
      msg.includes("deshabilitado") ||
      msg.includes("API key") ||
      msg.includes("API Key") ||
      msg.includes("Escriba") ||
      msg.includes("adjunte")
    ) {
      return badRequest(msg);
    }
    return serverError(msg, e);
  }
}
