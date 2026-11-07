/**
 * Siembra o sincroniza el examen F-OP-10 (conocimiento del Manual del Puesto).
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-formulario-fop10.ts
 */
import { PrismaClient } from "@prisma/client";
import { QUIZ_FOP10_MANUAL_PUESTO } from "../src/modules/formularios/seed/quiz-fop10-manual-puesto";
import type { QuizSeedQuestion } from "../src/modules/formularios/seed/quiz-sig-induccion";

const prisma = new PrismaClient();
const QUIZ = QUIZ_FOP10_MANUAL_PUESTO;

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

async function syncQuestionOptions(questionId: string, options: QuizSeedQuestion["options"]) {
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
      title: QUIZ.title,
      description: QUIZ.description,
      passScorePercent: QUIZ.passScorePercent,
    },
  });

  if (submissionCount === 0) {
    await prisma.formQuestion.deleteMany({ where: { formId } });
    for (let index = 0; index < QUIZ.questions.length; index++) {
      const q = QUIZ.questions[index] as QuizSeedQuestion;
      await prisma.formQuestion.create({
        data: { formId, ...questionCreateData(q, index) },
      });
    }
    console.log(`Formulario sincronizado (sin envíos previos): ${QUIZ.code}`);
    return;
  }

  for (let index = 0; index < QUIZ.questions.length; index++) {
    const q = QUIZ.questions[index] as QuizSeedQuestion;
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

  const extras = existingQuestions.slice(QUIZ.questions.length);
  for (const extra of extras) {
    if (extra._count.answers === 0) {
      await prisma.formQuestion.delete({ where: { id: extra.id } });
    }
  }

  console.log(`Formulario sincronizado (con ${submissionCount} envío(s) preservados): ${QUIZ.code}`);
}

async function main() {
  const existing = await prisma.formDefinition.findUnique({
    where: { code: QUIZ.code },
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
      code: QUIZ.code,
      title: QUIZ.title,
      description: QUIZ.description,
      passScorePercent: QUIZ.passScorePercent,
      isActive: true,
      createdById: admin?.id ?? null,
      questions: {
        create: QUIZ.questions.map((q, index) => questionCreateData(q, index)),
      },
    },
    include: { _count: { select: { questions: true } } },
  });

  console.log(`Formulario creado: ${form.code} (${form.id}) con ${form._count.questions} preguntas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
