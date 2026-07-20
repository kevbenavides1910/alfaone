import { PrismaClient } from "@prisma/client";
import { withAuditExtension } from "./prisma-audit";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

/** Cambia al regenerar el cliente Prisma; fuerza nueva instancia en dev tras migrate/generate. */
const PRISMA_CLIENT_VERSION = "20260709120000";

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  return withAuditExtension(base);
}

export const prisma =
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
}
