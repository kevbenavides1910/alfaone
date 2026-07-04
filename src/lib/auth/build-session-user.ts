import { prisma } from "@/modules/core/db/prisma";
import { getUserPermissionContext } from "@/lib/permissions/resolve";
import type { SessionUserPayload } from "@/lib/auth/session-cookie";
import type { UserRole } from "@prisma/client";

export async function buildSessionUserPayload(
  userId: string,
  impersonation?: { impersonatorId: string; impersonatorName: string },
): Promise<SessionUserPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      company: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive) return null;

  const ctx = await getUserPermissionContext(user.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    roleId: ctx?.roleId ?? null,
    roleCode: ctx?.roleCode ?? user.role,
    company: user.company,
    permissions: ctx?.permissions ?? {},
    mustChangePassword: user.mustChangePassword,
    impersonatorId: impersonation?.impersonatorId ?? null,
    impersonatorName: impersonation?.impersonatorName ?? null,
  };
}
