import { prisma } from "@/modules/core/db/prisma";
import type { FormQuestion, FormQuestionOption, FormQuestionType } from "@prisma/client";

export type AnswerPayload = {
  questionId: string;
  selectedOptionIds?: string[];
  trueFalse?: boolean;
  text?: string;
};

export type GradedAnswer = {
  questionId: string;
  answerJson: AnswerPayload;
  isCorrect: boolean | null;
};

function gradeQuestion(
  question: FormQuestion & { options: FormQuestionOption[] },
  answer: AnswerPayload
): boolean | null {
  switch (question.type as FormQuestionType) {
    case "SINGLE_CHOICE": {
      const selected = answer.selectedOptionIds ?? [];
      if (selected.length !== 1) return false;
      const opt = question.options.find((o) => o.id === selected[0]);
      return opt?.isCorrect === true;
    }
    case "MULTIPLE_CHOICE": {
      const selected = new Set(answer.selectedOptionIds ?? []);
      const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
      if (selected.size !== correctIds.size) return false;
      for (const id of correctIds) {
        if (!selected.has(id)) return false;
      }
      return true;
    }
    case "TRUE_FALSE": {
      if (answer.trueFalse === undefined || question.correctTrueFalse === null) return false;
      return answer.trueFalse === question.correctTrueFalse;
    }
    case "TEXT":
      return null;
    default:
      return null;
  }
}

export async function submitForm(formId: string, userId: string, answers: AnswerPayload[]) {
  const form = await prisma.formDefinition.findUnique({
    where: { id: formId },
    include: {
      questions: {
        include: { options: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!form || !form.isActive) {
    throw new Error("FORM_NOT_AVAILABLE");
  }

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const graded: GradedAnswer[] = form.questions.map((q) => {
    const payload = answerMap.get(q.id) ?? { questionId: q.id };
    const isCorrect = gradeQuestion(q, payload);
    return {
      questionId: q.id,
      answerJson: payload,
      isCorrect,
    };
  });

  const scorable = graded.filter((g) => g.isCorrect !== null);
  const earned = scorable.filter((g) => g.isCorrect === true).reduce((sum, g) => {
    const q = form.questions.find((x) => x.id === g.questionId);
    return sum + (q?.points ?? 1);
  }, 0);
  const maxPoints = scorable.reduce((sum, g) => {
    const q = form.questions.find((x) => x.id === g.questionId);
    return sum + (q?.points ?? 1);
  }, 0);

  const scorePercent = maxPoints > 0 ? Math.round((earned / maxPoints) * 100) : 0;
  const failedCritical = form.questions.some((q) => {
    if (!q.isCritical) return false;
    const g = graded.find((x) => x.questionId === q.id);
    return g?.isCorrect !== true;
  });
  const passed = scorePercent >= form.passScorePercent && !failedCritical;

  return prisma.$transaction(async (tx) => {
    const submission = await tx.formSubmission.create({
      data: {
        formId,
        userId,
        scorePercent,
        passed,
        answers: {
          create: graded.map((g) => ({
            questionId: g.questionId,
            answerJson: g.answerJson,
            isCorrect: g.isCorrect,
          })),
        },
      },
      include: {
        answers: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return submission;
  });
}

export async function listSubmissions(formId: string, page = 1, pageSize = 25) {
  const skip = (page - 1) * pageSize;
  const where = { formId };

  const [total, rows] = await Promise.all([
    prisma.formSubmission.count({ where }),
    prisma.formSubmission.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { submittedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { answers: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    rows,
  };
}

export async function getSubmissionById(submissionId: string) {
  const row = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    include: {
      form: { select: { id: true, code: true, title: true, passScorePercent: true } },
      user: { select: { id: true, name: true, email: true } },
      answers: {
        include: {
          question: {
            include: { options: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  if (!row) return null;

  const answers = row.answers
    .slice()
    .sort(
      (a, b) =>
        a.question.sortOrder - b.question.sortOrder ||
        a.question.createdAt.getTime() - b.question.createdAt.getTime()
    )
    .map((a) => formatSubmissionAnswer(a));

  return {
    id: row.id,
    formId: row.formId,
    scorePercent: row.scorePercent,
    passed: row.passed,
    submittedAt: row.submittedAt,
    user: row.user,
    form: row.form,
    answers,
  };
}

function formatCorrectAnswer(question: {
  type: string;
  correctTrueFalse: boolean | null;
  options: { id: string; label: string; isCorrect: boolean }[];
}): string {
  if (question.type === "TRUE_FALSE") {
    return question.correctTrueFalse ? "Verdadero" : "Falso";
  }
  if (question.type === "TEXT") {
    return "— (revisión manual)";
  }
  return question.options
    .filter((o) => o.isCorrect)
    .map((o) => o.label)
    .join("; ") || "—";
}

function formatGivenAnswer(
  question: {
    type: string;
    options: { id: string; label: string }[];
  },
  answerJson: { selectedOptionIds?: string[]; trueFalse?: boolean; text?: string }
): string {
  if (question.type === "TRUE_FALSE") {
    if (answerJson.trueFalse === undefined) return "Sin respuesta";
    return answerJson.trueFalse ? "Verdadero" : "Falso";
  }
  if (question.type === "TEXT") {
    return answerJson.text?.trim() || "Sin respuesta";
  }
  const ids = answerJson.selectedOptionIds ?? [];
  if (!ids.length) return "Sin respuesta";
  const labels = question.options
    .filter((o) => ids.includes(o.id))
    .map((o) => o.label);
  return labels.length ? labels.join("; ") : "Sin respuesta";
}

function formatSubmissionAnswer(a: {
  id: string;
  isCorrect: boolean | null;
  answerJson: unknown;
  question: {
    id: string;
    sortOrder: number;
    type: string;
    text: string;
    points: number;
    isCritical: boolean;
    correctTrueFalse: boolean | null;
    options: { id: string; label: string; isCorrect: boolean }[];
  };
}) {
  const payload = (a.answerJson ?? {}) as {
    selectedOptionIds?: string[];
    trueFalse?: boolean;
    text?: string;
  };

  return {
    id: a.id,
    questionId: a.question.id,
    sortOrder: a.question.sortOrder,
    questionText: a.question.text,
    questionType: a.question.type,
    points: a.question.points,
    isCritical: a.question.isCritical,
    givenAnswer: formatGivenAnswer(a.question, payload),
    correctAnswer: formatCorrectAnswer(a.question),
    isCorrect: a.isCorrect,
  };
}

/** Formulario activo para responder (sin revelar respuestas correctas). */
export async function getFormForTaking(id: string) {
  const form = await prisma.formDefinition.findUnique({
    where: { id },
    include: {
      questions: {
        where: {},
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          options: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { id: true, label: true, sortOrder: true },
          },
        },
      },
    },
  });

  if (!form) return null;

  return {
    id: form.id,
    code: form.code,
    title: form.title,
    description: form.description,
    passScorePercent: form.passScorePercent,
    isActive: form.isActive,
    questions: form.questions.map((q) => ({
      id: q.id,
      sortOrder: q.sortOrder,
      type: q.type,
      text: q.text,
      points: q.points,
      isCritical: q.isCritical,
      options: q.type === "TRUE_FALSE" || q.type === "TEXT" ? [] : q.options,
    })),
  };
}
