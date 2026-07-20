/**
 * Contexto de auditoría por request, propagado vía AsyncLocalStorage.
 *
 * Uso en API routes (automático vía apiHandler) o manualmente:
 *   runWithAuditContext({ userId: session.user.id, ipAddress }, () => doWork());
 */

import { AsyncLocalStorage } from "async_hooks";

export type AuditContext = {
  userId: string;
  ipAddress?: string | null;
};

const auditStorage = new AsyncLocalStorage<AuditContext>();

export function getAuditContext(): AuditContext | undefined {
  return auditStorage.getStore();
}

export function runWithAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditStorage.run(ctx, fn);
}
