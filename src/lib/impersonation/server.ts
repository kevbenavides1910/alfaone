import { headers } from "next/headers";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { prisma } from "@/modules/core/db/prisma";
import { getRolePermissions } from "@/lib/permissions/resolve";
import { userIsPlatformAdmin } from "@/modules/core/auth/impersonation-admin";
import { mergeImpersonationIntoSession } from "@/lib/impersonation/merge-session";
import { verifyImpersonationToken } from "@/lib/impersonation/verify-token";

const IMPERSONATION_HEADER = "x-impersonation-token";

async function resolveImpersonationToken(
  explicitToken?: string | null
): Promise<string | null> {
  if (explicitToken) return explicitToken;
  try {
    const h = await headers();
    return h.get(IMPERSONATION_HEADER);
  } catch {
    return null;
  }
}

/**
 * Sesión efectiva para handlers API: JWT de sesión + opcional token de vista previa
 * (header X-Impersonation-Token) cuando el admin prueba un rol en otra pestaña.
 */
export async function getEffectiveSession(
  impersonationToken?: string | null
): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const token = await resolveImpersonationToken(impersonationToken);
  if (!token) return session;

  const payload = await verifyImpersonationToken(token);
  if (!payload || payload.sub !== session.user.id) return session;

  const isAdmin = await userIsPlatformAdmin(session.user.id);
  if (!isAdmin) return session;

  const role = await prisma.role.findUnique({
    where: { id: payload.impersonatedRoleId },
    select: { id: true, code: true },
  });
  if (!role) return session;

  const permissions = await getRolePermissions(role.id);
  return mergeImpersonationIntoSession(session, role, permissions);
}
