import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import { authOptions } from "@/modules/core/auth/auth-options";
import type { PermissionMap } from "@/lib/permissions/resolve";

export type SessionUserPayload = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleId: string | null;
  roleCode: string;
  company: string | null;
  permissions: PermissionMap;
  mustChangePassword: boolean;
  impersonatorId?: string | null;
  impersonatorName?: string | null;
};

function sessionCookieName(): string {
  return authOptions.useSecureCookies
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export async function setUserSessionCookie(user: SessionUserPayload): Promise<void> {
  const secret = authOptions.secret;
  if (!secret) throw new Error("NEXTAUTH_SECRET no configurado");

  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      roleCode: user.roleCode,
      company: user.company,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword,
      impersonatorId: user.impersonatorId ?? null,
      impersonatorName: user.impersonatorName ?? null,
    },
    secret,
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: Boolean(authOptions.useSecureCookies),
    maxAge: authOptions.session?.maxAge,
  });
}
