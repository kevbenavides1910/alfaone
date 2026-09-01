import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/response";
import { getSkillById, listMemoriesBoard, listSkillsBoard } from "@/modules/syntra-ai/services/syntra-ai-memory";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const skillId = req.nextUrl.searchParams.get("skillId");

  try {
    if (skillId) {
      const skill = await getSkillById(session.user.id, skillId);
      if (!skill) return notFound("Skill no encontrado");
      return ok({ skill });
    }
    const board = await listSkillsBoard(session.user.id);
    return ok(board);
  } catch (e) {
    return serverError("Error al listar skills", e);
  }
}
