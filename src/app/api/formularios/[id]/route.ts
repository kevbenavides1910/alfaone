import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, noContent } from "@/lib/api/response";
import {
  deleteForm,
  getFormById,
  reorderQuestions,
  updateForm,
} from "@/modules/formularios/services/forms";
import { getFormForTaking } from "@/modules/formularios/services/submissions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await ctx.params;

  try {
    const forTaking = _req.nextUrl.searchParams.get("mode") === "take";
    if (forTaking) {
      if (!hasPermission(session, "formularios.catalogo", "view")) return forbidden();
      const form = await getFormForTaking(id);
      if (!form) return badRequest("Formulario no encontrado");
      return ok(form);
    }

    if (
      !hasPermission(session, "formularios.editor", "view") &&
      !hasPermission(session, "formularios.catalogo", "view")
    ) {
      return forbidden();
    }

    const row = await getFormById(id);
    if (!row) return badRequest("Formulario no encontrado");

    return ok({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      questions: row.questions.map((q) => ({
        ...q,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        options: q.options.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
        })),
      })),
    });
  } catch (e) {
    return serverError("Error al obtener formulario", e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.editor", "edit")) return forbidden();

  const { id } = await ctx.params;

  try {
    const body = await req.json();

    if (Array.isArray(body.questionOrder)) {
      await reorderQuestions(id, body.questionOrder as string[]);
      const row = await getFormById(id);
      if (!row) return badRequest("Formulario no encontrado");
      return ok({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    }

    const row = await updateForm(id, {
      code: typeof body.code === "string" ? body.code : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : body.description === null ? null : undefined,
      passScorePercent: typeof body.passScorePercent === "number" ? body.passScorePercent : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });

    return ok({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al actualizar formulario", e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.editor", "admin")) return forbidden();

  const { id } = await ctx.params;

  try {
    await deleteForm(id);
    return noContent();
  } catch (e) {
    return serverError("Error al eliminar formulario", e);
  }
}
