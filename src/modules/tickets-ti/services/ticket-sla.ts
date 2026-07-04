import type { PrismaClient, Prisma, TicketSlaRecordStatus } from "@prisma/client";

export async function createTicketSla(
  tx: Prisma.TransactionClient,
  ticketId: string,
  priorityId: string,
  targetMinutes: number
) {
  await tx.ticketSla.create({
    data: {
      ticketId,
      priorityId,
      targetMinutes,
      remainingMinutes: targetMinutes,
      status: "ACTIVE",
    },
  });
}

export async function syncSlaForStatus(
  db: PrismaClient | Prisma.TransactionClient,
  ticketId: string,
  pausesSla: boolean
) {
  const sla = await db.ticketSla.findFirst({
    where: { ticketId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!sla) return;

  const now = new Date();
  if (pausesSla && sla.status === "ACTIVE") {
    const elapsed = Math.floor((now.getTime() - sla.startedAt.getTime()) / 60_000);
    await db.ticketSla.update({
      where: { id: sla.id },
      data: {
        status: "PAUSED",
        pausedAt: now,
        elapsedMinutes: sla.elapsedMinutes + Math.max(0, elapsed - sla.pausedMinutes),
        remainingMinutes: Math.max(0, sla.targetMinutes - sla.elapsedMinutes),
      },
    });
    return;
  }

  if (!pausesSla && sla.status === "PAUSED" && sla.pausedAt) {
    const pauseDuration = Math.floor((now.getTime() - sla.pausedAt.getTime()) / 60_000);
    await db.ticketSla.update({
      where: { id: sla.id },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        pausedMinutes: sla.pausedMinutes + pauseDuration,
      },
    });
  }
}

export async function finishSla(
  tx: Prisma.TransactionClient,
  ticketId: string,
  finalStatus: TicketSlaRecordStatus
) {
  const sla = await tx.ticketSla.findFirst({
    where: { ticketId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!sla) return;
  const now = new Date();
  let elapsed = sla.elapsedMinutes;
  if (sla.status === "ACTIVE") {
    elapsed += Math.floor((now.getTime() - sla.startedAt.getTime()) / 60_000) - sla.pausedMinutes;
  }
  await tx.ticketSla.update({
    where: { id: sla.id },
    data: {
      status: finalStatus,
      finishedAt: now,
      elapsedMinutes: Math.max(0, elapsed),
      remainingMinutes: Math.max(0, sla.targetMinutes - elapsed),
    },
  });
}
