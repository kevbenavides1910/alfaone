import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, created } from "@/lib/api/response";
import { createQuestion } from "@/modules/formularios/services/forms";
import type { FormQuestionType } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const VALID_TYPES: FormQuestionType[] = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "TEXT"];

function parseQuestionBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.text !== "string" || !b.text.trim()) return null;
  if (typeof b.type !== "string" || !VALID_TYPES.includes(b.type as FormQuestionType)) return null;

  const options = Array.isArray(b.options)
    ? b.options
        .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
        .map((o, i) => ({
          label: String(o.label ?? ""),
          isCorrect: o.isCorrect === true,
          sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : i,
        }))
        .filter((o) => o.label.trim())
    : undefined;

  return {
    text: b.text,
    type: b.type as FormQuestionType,
    points: typeof b.points === "number" ? b.points : 1,
    isCritical: b.isCritical === true,
    correctTrueFalse: typeof b.correctTrueFalse === "boolean" ? b.correctTrueFalse : null,
    sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
    options,
  };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.editor", "edit")) return forbidden();

  const { id: formId } = await ctx.params;

  try {
    const body = await req.json();
    const parsed = parseQuestionBody(body);
    if (!parsed) return badRequest("Datos de pregunta inválidos");

    const row = await createQuestion(formId, parsed);
    return created({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      options: row.options.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return serverError("Error al crear pregunta", e);
  }
}
