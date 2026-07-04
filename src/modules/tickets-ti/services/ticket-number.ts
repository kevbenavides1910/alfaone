import type { PrismaClient, Prisma } from "@prisma/client";

export async function allocateTicketNumber(
  db: PrismaClient | Prisma.TransactionClient,
  year = new Date().getFullYear()
): Promise<string> {
  const row = await db.ticketSequence.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const num = row.lastNumber;
  return `TI-${year}-${String(num).padStart(6, "0")}`;
}
