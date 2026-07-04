import type { FeJobTipo, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";

export class FeJobQueueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(params: {
    jobType: FeJobTipo;
    payload: Record<string, unknown>;
    runAt?: Date;
    empresaId?: string;
    comprobanteId?: string;
    maxAttempts?: number;
  }) {
    return this.prisma.feJobQueue.create({
      data: {
        jobType: params.jobType,
        payload: JSON.stringify(params.payload),
        runAt: params.runAt ?? new Date(),
        empresaId: params.empresaId,
        comprobanteId: params.comprobanteId,
        maxAttempts: params.maxAttempts ?? 5,
      },
    });
  }

  async claimDue(limit = 20, workerId: string) {
    const now = new Date();
    const due = await this.prisma.feJobQueue.findMany({
      where: {
        ...notDeleted,
        runAt: { lte: now },
        lockedAt: null,
      },
      orderBy: { runAt: "asc" },
      take: limit * 2,
    });

    const eligible = due.filter((job) => job.attempts < job.maxAttempts).slice(0, limit);

    const claimed = [];
    for (const job of eligible) {
      const updated = await this.prisma.feJobQueue.updateMany({
        where: { id: job.id, lockedAt: null, ...notDeleted },
        data: { lockedAt: now, lockedBy: workerId },
      });
      if (updated.count === 1) claimed.push(job);
    }
    return claimed;
  }

  async complete(id: string) {
    await this.prisma.feJobQueue.update({
      where: { id },
      data: { deletedAt: new Date(), lockedAt: null, lockedBy: null },
    });
  }

  async fail(id: string, error: string, retryInMs?: number) {
    const job = await this.prisma.feJobQueue.findUniqueOrThrow({ where: { id } });
    const attempts = job.attempts + 1;
    const exhausted = attempts >= job.maxAttempts;

    await this.prisma.feJobQueue.update({
      where: { id },
      data: {
        attempts,
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        runAt: exhausted ? job.runAt : new Date(Date.now() + (retryInMs ?? 60_000)),
        ...(exhausted ? { deletedAt: new Date() } : {}),
      },
    });
  }
}
