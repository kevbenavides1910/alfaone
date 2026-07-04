import { prisma } from "@/modules/core/db/prisma";
import type { FormQuestionType, Prisma } from "@prisma/client";

export type FormListFilters = {
  q?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};

const formInclude = {
  _count: { select: { questions: true, submissions: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.FormDefinitionInclude;

export async function listForms(filters: FormListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.FormDefinitionWhereInput = {};
  if (filters.activeOnly) where.isActive = true;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.formDefinition.count({ where }),
    prisma.formDefinition.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }],
      include: formInclude,
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

export async function getFormById(id: string) {
  return prisma.formDefinition.findUnique({
    where: { id },
    include: {
      ...formInclude,
      questions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          options: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });
}

export type UpsertFormInput = {
  code: string;
  title: string;
  description?: string | null;
  passScorePercent?: number;
  isActive?: boolean;
};

export async function createForm(input: UpsertFormInput, actorId: string) {
  return prisma.formDefinition.create({
    data: {
      code: input.code.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      passScorePercent: input.passScorePercent ?? 80,
      isActive: input.isActive ?? true,
      createdById: actorId,
    },
    include: formInclude,
  });
}

export async function updateForm(id: string, input: Partial<UpsertFormInput>) {
  const data: Prisma.FormDefinitionUpdateInput = {};
  if (input.code !== undefined) data.code = input.code.trim();
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.passScorePercent !== undefined) data.passScorePercent = input.passScorePercent;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.formDefinition.update({
    where: { id },
    data,
    include: formInclude,
  });
}

export async function deleteForm(id: string) {
  return prisma.formDefinition.delete({ where: { id } });
}

export type UpsertQuestionInput = {
  text: string;
  type: FormQuestionType;
  points?: number;
  isCritical?: boolean;
  correctTrueFalse?: boolean | null;
  sortOrder?: number;
  options?: { label: string; isCorrect: boolean; sortOrder?: number }[];
};

export async function createQuestion(formId: string, input: UpsertQuestionInput) {
  const sortOrder =
    input.sortOrder ??
    ((await prisma.formQuestion.aggregate({ where: { formId }, _max: { sortOrder: true } }))._max
      .sortOrder ?? -1) + 1;

  return prisma.$transaction(async (tx) => {
    const question = await tx.formQuestion.create({
      data: {
        formId,
        sortOrder,
        text: input.text.trim(),
        type: input.type,
        points: input.points ?? 1,
        isCritical: input.isCritical ?? false,
        correctTrueFalse: input.type === "TRUE_FALSE" ? (input.correctTrueFalse ?? null) : null,
      },
    });

    if (input.options?.length) {
      await tx.formQuestionOption.createMany({
        data: input.options.map((o, i) => ({
          questionId: question.id,
          sortOrder: o.sortOrder ?? i,
          label: o.label.trim(),
          isCorrect: o.isCorrect,
        })),
      });
    }

    return tx.formQuestion.findUniqueOrThrow({
      where: { id: question.id },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
  });
}

export async function updateQuestion(questionId: string, input: UpsertQuestionInput) {
  return prisma.$transaction(async (tx) => {
    await tx.formQuestion.update({
      where: { id: questionId },
      data: {
        text: input.text.trim(),
        type: input.type,
        points: input.points ?? 1,
        isCritical: input.isCritical ?? false,
        correctTrueFalse: input.type === "TRUE_FALSE" ? (input.correctTrueFalse ?? null) : null,
        sortOrder: input.sortOrder,
      },
    });

    if (input.options !== undefined) {
      await tx.formQuestionOption.deleteMany({ where: { questionId } });
      if (input.options.length) {
        await tx.formQuestionOption.createMany({
          data: input.options.map((o, i) => ({
            questionId,
            sortOrder: o.sortOrder ?? i,
            label: o.label.trim(),
            isCorrect: o.isCorrect,
          })),
        });
      }
    }

    return tx.formQuestion.findUniqueOrThrow({
      where: { id: questionId },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
  });
}

export async function deleteQuestion(questionId: string) {
  return prisma.formQuestion.delete({ where: { id: questionId } });
}

export async function reorderQuestions(formId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.formQuestion.updateMany({
        where: { id, formId },
        data: { sortOrder: index },
      })
    )
  );
}
