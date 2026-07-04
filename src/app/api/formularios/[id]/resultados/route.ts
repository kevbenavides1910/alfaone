import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listSubmissions } from "@/modules/formularios/services/submissions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.resultados", "view")) return forbidden();

  const { id } = await ctx.params;

  try {
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "25");
    const result = await listSubmissions(id, page, pageSize);

    return ok({
      ...result,
      rows: result.rows.map((r) => ({
        ...r,
        submittedAt: r.submittedAt.toISOString(),
      })),
    });
  } catch (e) {
    return serverError("Error al listar resultados", e);
  }
}
