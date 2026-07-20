import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/modules/core/db/prisma";
import type { UserRole } from "@prisma/client";
import { getUserPermissionContext, getRolePermissions } from "@/lib/permissions/resolve";
import type { PermissionMap } from "@/lib/permissions/resolve";
import { legacyRoleFromCode } from "@/lib/impersonation/merge-session";
import { userIsPlatformAdmin } from "@/modules/core/auth/impersonation-admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      roleId: string | null;
      roleCode: string;
      company: string | null;
      permissions: PermissionMap;
      mustChangePassword: boolean;
      impersonatedRoleId?: string | null;
      impersonatedRoleCode?: string | null;
    };
  }
  interface User {
    role: UserRole;
    roleId: string | null;
    roleCode: string;
    company: string | null;
    permissions: PermissionMap;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    roleId: string | null;
    roleCode: string;
    company: string | null;
    permissions: PermissionMap;
    mustChangePassword: boolean;
    realRoleId?: string | null;
    realRoleCode?: string | null;
    impersonatedRoleId?: string | null;
    impersonatedRoleCode?: string | null;
  }
}

async function applyImpersonatedRole(
  token: import("next-auth/jwt").JWT,
  roleId: string,
): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, code: true },
  });
  if (!role) return;

  if (!token.realRoleId) {
    token.realRoleId = token.roleId ?? null;
    token.realRoleCode = token.roleCode ?? null;
  }

  token.impersonatedRoleId = role.id;
  token.impersonatedRoleCode = role.code;
  token.roleId = role.id;
  token.roleCode = role.code;
  token.permissions = await getRolePermissions(role.id);
  token.role = legacyRoleFromCode(role.code);
}

async function clearImpersonation(token: import("next-auth/jwt").JWT): Promise<void> {
  const userId = token.id as string;
  if (token.realRoleId) {
    const role = await prisma.role.findUnique({
      where: { id: token.realRoleId },
      select: { id: true, code: true },
    });
    if (role) {
      token.roleId = role.id;
      token.roleCode = role.code;
      token.permissions = await getRolePermissions(role.id);
      token.role = legacyRoleFromCode(role.code);
    } else {
      const ctx = await getUserPermissionContext(userId);
      if (ctx) {
        token.roleId = ctx.roleId;
        token.roleCode = ctx.roleCode;
        token.permissions = ctx.permissions;
      }
    }
  } else {
    const ctx = await getUserPermissionContext(userId);
    if (ctx) {
      token.roleId = ctx.roleId;
      token.roleCode = ctx.roleCode;
      token.permissions = ctx.permissions;
    }
  }
  delete token.impersonatedRoleId;
  delete token.impersonatedRoleCode;
  delete token.realRoleId;
  delete token.realRoleCode;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user) token.role = user.role;
}

/** En dev, un secret fijo si falta en .env evita JWT inválidos y sesiones que no “pegan”. En producción debe existir NEXTAUTH_SECRET. */
function resolveAuthSecret(): string | undefined {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";

  if (process.env.NODE_ENV === "production" && !isBuild) {
    if (!fromEnv || fromEnv.length < 32) {
      throw new Error(
        "NEXTAUTH_SECRET es obligatorio en producción (mín. 32 caracteres). Genere con: openssl rand -base64 32",
      );
    }
    return fromEnv;
  }

  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "presupuestos-alfa-dev-nextauth-secret-not-for-production";
  }
  if (isBuild) {
    return fromEnv || "ci-build-placeholder-secret-min-32-characters!!";
  }
  return undefined;
}

function shouldUseSecureCookies(): boolean {
  const url = process.env.NEXTAUTH_URL?.trim().toLowerCase();
  if (!url) return false;
  return url.startsWith("https://");
}

export const authOptions: NextAuthOptions = {
  secret: resolveAuthSecret(),
  useSecureCookies: shouldUseSecureCookies(),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.passwordHash || !user.isActive) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

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
          };
        } catch (e) {
          console.error("[next-auth authorize]", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.id = user.id;
        token.role = user.role;
        token.roleId = user.roleId;
        token.roleCode = user.roleCode;
        token.company = user.company;
        token.permissions = user.permissions;
        token.mustChangePassword = user.mustChangePassword;
      } else if (trigger === "update" && session) {
        const userId = token.id as string;
        const s = session as {
          impersonatedRoleId?: string | null;
          clearImpersonation?: boolean;
        };

        if (s.clearImpersonation) {
          await clearImpersonation(token);
        } else if (s.impersonatedRoleId && (await userIsPlatformAdmin(userId))) {
          await applyImpersonatedRole(token, s.impersonatedRoleId);
        }
      } else if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { mustChangePassword: true },
        });
        if (dbUser) token.mustChangePassword = dbUser.mustChangePassword;

        if (token.impersonatedRoleId) {
          token.permissions = await getRolePermissions(token.impersonatedRoleId);
        } else {
          const ctx = await getUserPermissionContext(token.id as string);
          if (ctx) {
            token.roleId = ctx.roleId;
            token.roleCode = ctx.roleCode;
            token.permissions = ctx.permissions;
            token.role = legacyRoleFromCode(ctx.roleCode);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        const uid =
          (typeof token.id === "string" && token.id ? token.id : null) ??
          (token.sub as string | undefined);
        if (uid) session.user.id = uid;
        session.user.role = token.role;
        session.user.roleId = token.roleId ?? null;
        session.user.roleCode = token.roleCode ?? token.role;
        session.user.company = token.company ?? null;
        session.user.permissions = token.permissions ?? {};
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.impersonatedRoleId = token.impersonatedRoleId ?? null;
        session.user.impersonatedRoleCode = token.impersonatedRoleCode ?? null;
      }
      return session;
    },
  },
};
