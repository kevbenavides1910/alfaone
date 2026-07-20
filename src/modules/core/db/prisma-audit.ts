/**
 * Extensión Prisma para audit trail automático en modelos críticos.
 *
 * Solo registra cambios cuando hay un AuditContext activo (vía runWithAuditContext).
 * Usa el cliente base para lecturas/escrituras de audit_logs y evitar recursión.
 */

import type { PrismaClient } from "@prisma/client";
import { getAuditContext } from "./audit-context";
import { writeAuditLog } from "@/modules/core/audit/write-audit-log";

/** Modelos cuyos UPDATE/DELETE se auditan automáticamente. */
const AUDITED_MODELS = new Set(["expense", "asset"]);

type WhereUnique = Record<string, unknown>;

type QueryArgs = {
  model: string;
  args: { where: WhereUnique };
  query: (args: unknown) => Promise<Record<string, unknown> | null>;
};

export function withAuditExtension(base: PrismaClient): PrismaClient {
  return base.$extends({
    query: {
      $allModels: {
        async update({ model, args, query }: QueryArgs) {
          if (!AUDITED_MODELS.has(model)) return query(args);

          const ctx = getAuditContext();
          const where = args.where as WhereUnique;
          const before = ctx ? await fetchEntitySnapshot(base, model, where) : null;
          const result = await query(args);

          if (ctx && before) {
            await writeAuditLog(base, {
              userId: ctx.userId,
              entityType: model,
              entityId: String(result?.id ?? extractIdFromWhere(where)),
              action: "UPDATE",
              previousData: before,
              newData: result,
              contractId: extractContractId(before, result),
              ipAddress: ctx.ipAddress,
            });
          }

          return result;
        },
        async delete({ model, args, query }: QueryArgs) {
          const ctx = getAuditContext();
          const where = args.where as WhereUnique;

          if (AUDITED_MODELS.has(model) && ctx) {
            const before = await fetchEntitySnapshot(base, model, where);
            const result = await query(args);
            const entityId = String(
              (before as { id?: string } | null)?.id ?? extractIdFromWhere(where)
            );
            await writeAuditLog(base, {
              userId: ctx.userId,
              entityType: model,
              entityId,
              action: "DELETE",
              previousData: before,
              newData: null,
              contractId: extractContractId(before, null),
              ipAddress: ctx.ipAddress,
            });
            return result;
          }

          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractIdFromWhere(where: WhereUnique): string {
  if (typeof where.id === "string") return where.id;
  return "unknown";
}

function extractContractId(before: unknown, after: unknown): string | null {
  const fromAfter = (after as { contractId?: string | null } | null)?.contractId;
  if (fromAfter) return fromAfter;
  const fromBefore = (before as { contractId?: string | null } | null)?.contractId;
  return fromBefore ?? null;
}

async function fetchEntitySnapshot(
  base: PrismaClient,
  model: string,
  where: WhereUnique
): Promise<unknown | null> {
  try {
    const delegate = (base as unknown as Record<
      string,
      { findUnique?: (args: { where: WhereUnique }) => Promise<unknown> }
    >)[model];
    if (!delegate?.findUnique) return null;
    return delegate.findUnique({ where });
  } catch {
    return null;
  }
}
