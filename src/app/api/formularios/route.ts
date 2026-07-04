import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, created } from "@/lib/api/response";
import { createForm, listForms } from "@/modules/formularios/services/forms";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.catalogo", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") ?? "1");
    const pageSize = Number(sp.get("pageSize") ?? "25");
    const q = sp.get("q") ?? undefined;
    const activeOnly = sp.get("activeOnly") === "1";

    const result = await listForms({ page, pageSize, q, activeOnly });
    return ok({
      ...result,
      rows: result.rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return serverError("Error al listar formularios", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.editor", "edit")) return forbidden();

  try {
    const body = await req.json();
    if (typeof body.code !== "string" || !body.code.trim()) return badRequest("Código requerido");
    if (typeof body.title !== "string" || !body.title.trim()) return badRequest("Título requerido");

    const passScorePercent =
      typeof body.passScorePercent === "number" ? body.passScorePercent : 80;

    const row = await createForm(
      {
        code: body.code,
        title: body.title,
        description: typeof body.description === "string" ? body.description : null,
        passScorePercent,
        isActive: body.isActive !== false,
      },
      session.user.id
    );

    return created({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al crear formulario", e);
  }
}
