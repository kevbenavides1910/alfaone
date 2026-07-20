/**
 * Helpers para obtener un cliente Prisma con scope de empresa según la sesión.
 */

import type { Session } from "next-auth";
import type { PrismaClient } from "@prisma/client";
import { scopedPrisma } from "./prisma-tenant";
import { prisma } from "./prisma";

type SessionUser = Pick<Session["user"], "company">;

/**
 * Devuelve un cliente Prisma con filtro automático de empresa si el usuario
 * pertenece a una. Admins globales (company === null) reciben el cliente sin scope.
 */
export function dbForSession(session: { user: SessionUser }): PrismaClient {
  return scopedPrisma(session.user.company);
}

/** Empresa efectiva para filtros: la sesión manda; solo admins globales eligen por parámetro. */
export function resolveTenantCompany(
  session: { user: SessionUser },
  requestedCompany?: string | null
): string | undefined {
  if (session.user.company) return session.user.company;
  return requestedCompany ?? undefined;
}

/**
 * Valida que un usuario tenant no intente operar sobre otra empresa.
 * Retorna la empresa efectiva si la operación es válida.
 */
export function assertTenantCompanyAccess(
  session: { user: SessionUser },
  requestedCompany: string
): { ok: true; company: string } | { ok: false; message: string } {
  if (session.user.company && session.user.company !== requestedCompany) {
    return { ok: false, message: "No puede operar sobre otra empresa" };
  }
  return { ok: true, company: session.user.company ?? requestedCompany };
}

export { prisma };
