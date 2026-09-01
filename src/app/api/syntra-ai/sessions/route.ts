import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, badRequest, notFound, serverError } from "@/lib/api/response";
import { getSyntraAiSession, listSyntraAiSessions } from "@/modules/syntra-ai";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const sessionId = req.nextUrl.searchParams.get("sessionId");

  try {
    if (sessionId) {
      const data = await getSyntraAiSession(session.user.id, sessionId);
      if (!data) return notFound("Sesión no encontrada");
      return ok(data);
    }
    const sessions = await listSyntraAiSessions(session.user.id);
    return ok({ sessions });
  } catch (e) {
    return serverError("Error al listar conversaciones", e);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return badRequest("Falta sessionId");

  try {
    const { prisma } = await import("@/modules/core/db/prisma");
    const row = await prisma.syntraAiChatSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    });
    if (!row) return notFound("Sesión no encontrada");
    await prisma.syntraAiChatSession.update({
      where: { id: sessionId },
      data: { active: false },
    });
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error al eliminar conversación", e);
  }
}
