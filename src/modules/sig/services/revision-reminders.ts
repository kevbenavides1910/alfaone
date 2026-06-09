import { prisma } from "@/modules/core/db/prisma";

const MS_PER_DAY = 86_400_000;

export type SigRevisionReminder = {
  documentId: string;
  code: string;
  title: string;
  revisionIntervalDays: number;
  lastRevisionDate: string;
  nextRevisionDue: string;
  daysUntilDue: number;
  isOverdue: boolean;
};

/** Documentos aprobados cuya próxima revisión vence en los próximos `withinDays` días (o ya venció). */
export async function listSigRevisionReminders(withinDays = 30): Promise<SigRevisionReminder[]> {
  const docs = await prisma.sigDocument.findMany({
    where: {
      status: "APPROVED",
      revisionIntervalDays: { not: null, gt: 0 },
      currentVersion: { isNot: null },
    },
    select: {
      id: true,
      code: true,
      title: true,
      revisionIntervalDays: true,
      currentVersion: {
        select: { revisionDate: true },
      },
    },
  });

  const now = Date.now();
  const reminders: SigRevisionReminder[] = [];

  for (const doc of docs) {
    const interval = doc.revisionIntervalDays!;
    const revisionDate = doc.currentVersion!.revisionDate;
    const nextDue = new Date(revisionDate.getTime() + interval * MS_PER_DAY);
    const daysUntil = Math.ceil((nextDue.getTime() - now) / MS_PER_DAY);

    if (daysUntil <= withinDays) {
      reminders.push({
        documentId: doc.id,
        code: doc.code,
        title: doc.title,
        revisionIntervalDays: interval,
        lastRevisionDate: revisionDate.toISOString(),
        nextRevisionDue: nextDue.toISOString(),
        daysUntilDue: daysUntil,
        isOverdue: daysUntil < 0,
      });
    }
  }

  return reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
