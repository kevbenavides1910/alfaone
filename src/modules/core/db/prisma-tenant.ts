/**
 * Extensión Prisma para aislamiento multi-tenant automático.
 *
 * Uso:
 *   import { dbForSession } from "@/modules/core/db/db-for-session";
 *
 *   const db = dbForSession(session);
 *   const expenses = await db.expense.findMany({ ... }); // company se inyecta sola
 *
 * Modelos cubiertos: Contract, Expense, DeferredExpense, AdminExpense.
 * Para usuarios globales (company === null | undefined) se devuelve el cliente sin scope.
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/** Modelos y campo que actúa como discriminador de empresa. */
const TENANT_MODELS = new Map<string, string>([
  ["contract", "company"],
  ["expense", "company"],
  ["deferredExpense", "company"],
  ["adminExpense", "company"],
]);

function mergeTenantWhere(
  where: Record<string, unknown> | undefined,
  field: string,
  company: string
): Record<string, unknown> {
  return { ...((where as object) ?? {}), [field]: company };
}

function mergeTenantData(
  data: Record<string, unknown>,
  field: string,
  company: string
): Record<string, unknown> {
  return { ...data, [field]: company };
}

/**
 * Devuelve un cliente Prisma extendido que inyecta automáticamente el filtro
 * `where: { company }` en lecturas y escrituras sobre modelos tenant-scoped.
 *
 * Si `company` es null o undefined, devuelve el cliente sin scope (admins globales).
 */
export function scopedPrisma(company: string | null | undefined): PrismaClient {
  if (!company) return prisma;
  const scoped = prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        async findFirst({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        // findUnique no acepta campos no-únicos en where → redirigir a findFirst
        async findUnique({ model, args }: any) {
          if (!TENANT_MODELS.has(model)) {
            return (prisma as any)[model].findUnique(args);
          }
          const field = TENANT_MODELS.get(model)!;
          return (scoped as any)[model].findFirst({
            where: mergeTenantWhere(args.where, field, company),
            select: args.select,
            include: args.include,
          });
        },
        async count({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        async aggregate({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        async update({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        async updateMany({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        async delete({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        async deleteMany({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.where = mergeTenantWhere(args.where, field, company);
          }
          return query(args);
        },
        async create({ model, args, query }: any) {
          if (TENANT_MODELS.has(model)) {
            const field = TENANT_MODELS.get(model)!;
            args.data = mergeTenantData(args.data, field, company);
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;

  return scoped;
}
