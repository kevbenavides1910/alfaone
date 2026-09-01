import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, serverError } from "@/lib/api/response";
import { listMemoriesBoard } from "@/modules/syntra-ai/services/syntra-ai-memory";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const board = await listMemoriesBoard(session.user.id);
    return ok(board);
  } catch (e) {
    return serverError("Error al listar memoria", e);
  }
}
