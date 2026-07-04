/**
 * Siembra o sincroniza el quiz de inducción SIG (personal administrativo).
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-formulario-sig-quiz.ts
 */
import { PrismaClient } from "@prisma/client";
import { QUIZ_SIG_INDUCCION } from "../src/modules/formularios/seed/quiz-sig-induccion";
import type { QuizSeedQuestion } from "../src/modules/formularios/seed/quiz-sig-induccion";

const prisma = new PrismaClient();

function questionCreateData(q: QuizSeedQuestion, index: number) {
  return {
    sortOrder: index,
    text: q.text,
    type: q.type,
    points: q.points ?? 1,
    isCritical: q.isCritical ?? false,
    correctTrueFalse: q.type === "TRUE_FALSE" ? (q.correctTrueFalse ?? null) : null,
    options:
      q.options && q.options.length
        ? {
            create: q.options.map((o, oi) => ({
              sortOrder: oi,
              label: o.label,
              isCorrect: o.isCorrect,
            })),
          }
        : undefined,
  };
}

async function syncQuestionOptions(
  questionId: string,
  options: QuizSeedQuestion["options"]
) {
  await prisma.formQuestionOption.deleteMany({ where: { questionId } });
  if (options?.length) {
    await prisma.formQuestionOption.createMany({
      data: options.map((o, oi) => ({
        questionId,
        sortOrder: oi,
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    });
  }
}

async function syncExistingForm(formId: string) {
  const submissionCount = await prisma.formSubmission.count({ where: { formId } });
  const existingQuestions = await prisma.formQuestion.findMany({
    where: { formId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { answers: true } } },
  });

  await prisma.formDefinition.update({
    where: { id: formId },
    data: {
      title: QUIZ_SIG_INDUCCION.title,
      description: QUIZ_SIG_INDUCCION.description,
      passScorePercent: QUIZ_SIG_INDUCCION.passScorePercent,
    },
  });

  if (submissionCount === 0) {
    await prisma.formQuestion.deleteMany({ where: { formId } });
    for (let index = 0; index < QUIZ_SIG_INDUCCION.questions.length; index++) {
    const q = QUIZ_SIG_INDUCCION.questions[index] as QuizSeedQuestion;
      await prisma.formQuestion.create({
        data: { formId, ...questionCreateData(q, index) },
      });
    }
    console.log(`Formulario sincronizado (sin envíos previos): ${QUIZ_SIG_INDUCCION.code}`);
    return;
  }

  for (let index = 0; index < QUIZ_SIG_INDUCCION.questions.length; index++) {
    const q = QUIZ_SIG_INDUCCION.questions[index] as QuizSeedQuestion;
    const existing = existingQuestions[index];
    if (existing) {
      await prisma.formQuestion.update({
        where: { id: existing.id },
        data: {
          sortOrder: index,
          text: q.text,
          type: q.type,
          points: q.points ?? 1,
          isCritical: q.isCritical ?? false,
          correctTrueFalse: q.type === "TRUE_FALSE" ? (q.correctTrueFalse ?? null) : null,
        },
      });
      await syncQuestionOptions(existing.id, q.options);
    } else {
      await prisma.formQuestion.create({
        data: { formId, ...questionCreateData(q, index) },
      });
    }
  }

  const extras = existingQuestions.slice(QUIZ_SIG_INDUCCION.questions.length);
  for (const extra of extras) {
    if (extra._count.answers === 0) {
      await prisma.formQuestion.delete({ where: { id: extra.id } });
    }
  }

  console.log(
    `Formulario sincronizado (con ${submissionCount} envío(s) preservados): ${QUIZ_SIG_INDUCCION.code}`
  );
}

async function main() {
  const existing = await prisma.formDefinition.findUnique({
    where: { code: QUIZ_SIG_INDUCCION.code },
  });

  if (existing) {
    await syncExistingForm(existing.id);
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const form = await prisma.formDefinition.create({
    data: {
      code: QUIZ_SIG_INDUCCION.code,
      title: QUIZ_SIG_INDUCCION.title,
      description: QUIZ_SIG_INDUCCION.description,
      passScorePercent: QUIZ_SIG_INDUCCION.passScorePercent,
      isActive: true,
      createdById: admin?.id ?? null,
      questions: {
        create: QUIZ_SIG_INDUCCION.questions.map((q, index) => questionCreateData(q, index)),
      },
    },
    include: { _count: { select: { questions: true } } },
  });

  console.log(
    `Formulario creado: ${form.code} (${form.id}) con ${form._count.questions} preguntas.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
