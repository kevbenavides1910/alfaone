import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, created } from "@/lib/api/response";
import { submitForm, getSubmissionById, type AnswerPayload } from "@/modules/formularios/services/submissions";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.catalogo", "view")) return forbidden();

  const { id: formId } = await ctx.params;

  try {
    const body = await req.json();
    if (!Array.isArray(body.answers)) return badRequest("Respuestas requeridas");

    const answers: AnswerPayload[] = body.answers
      .filter((a: unknown) => a && typeof a === "object" && typeof (a as AnswerPayload).questionId === "string")
      .map((a: AnswerPayload) => ({
        questionId: a.questionId,
        selectedOptionIds: Array.isArray(a.selectedOptionIds) ? a.selectedOptionIds : undefined,
        trueFalse: typeof a.trueFalse === "boolean" ? a.trueFalse : undefined,
        text: typeof a.text === "string" ? a.text : undefined,
      }));

    const submission = await submitForm(formId, session.user.id, answers);
    const detail = await getSubmissionById(submission.id);

    return created({
      id: submission.id,
      scorePercent: submission.scorePercent,
      passed: submission.passed,
      submittedAt: submission.submittedAt.toISOString(),
      incorrectAnswers: detail?.answers.filter((a) => a.isCorrect === false) ?? [],
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORM_NOT_AVAILABLE") {
      return badRequest("Formulario no disponible");
    }
    return serverError("Error al enviar respuestas", e);
  }
}
