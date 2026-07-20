import type { Prisma, PrismaClient } from "@prisma/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "SOFT_DELETE";

type Db = PrismaClient | Prisma.TransactionClient;

export type WriteAuditLogInput = {
  userId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  previousData?: unknown;
  newData?: unknown;
  contractId?: string | null;
  ipAddress?: string | null;
};

function serializeAuditPayload(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? v.toString() : v
    );
  } catch {
    return String(value);
  }
}

/**
 * Escribe una entrada inmutable en audit_logs.
 * Usar dentro de transacciones para garantizar atomicidad con el cambio de negocio.
 */
export async function writeAuditLog(db: Db, input: WriteAuditLogInput) {
  return db.auditLog.create({
    data: {
      userId: input.userId,
      contractId: input.contractId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      previousData: serializeAuditPayload(input.previousData),
      newData: serializeAuditPayload(input.newData),
      ipAddress: input.ipAddress ?? null,
    },
  });
}
