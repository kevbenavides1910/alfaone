import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api/response";
import { syntraAiChat } from "@/modules/syntra-ai";

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  sessionId: z.string().optional().nullable(),
  pagePath: z.string().optional().nullable(),
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

  try {
    const result = await syntraAiChat({
      userId: session.user.id,
      message: parsed.data.message,
      history: parsed.data.history,
      sessionId: parsed.data.sessionId,
      pagePath: parsed.data.pagePath,
    });
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en el asistente IA";
    if (msg.includes("deshabilitado") || msg.includes("API key") || msg.includes("Escriba")) {
      return badRequest(msg);
    }
    return serverError(msg, e);
  }
}
