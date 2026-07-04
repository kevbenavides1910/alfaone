import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/modules/core/db/prisma";
import type { UserRole } from "@prisma/client";
import { getUserPermissionContext } from "@/lib/permissions/resolve";
import type { PermissionMap } from "@/lib/permissions/resolve";

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
  }
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
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || !user.passwordHash || !user.isActive) return null;

          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;
        token.id = user.id;
        token.role = user.role;
        token.roleId = user.roleId;
        token.roleCode = user.roleCode;
        token.company = user.company;
        token.permissions = user.permissions;
        token.mustChangePassword = user.mustChangePassword;
      } else if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { mustChangePassword: true },
        });
        if (dbUser) token.mustChangePassword = dbUser.mustChangePassword;
        const ctx = await getUserPermissionContext(token.id as string);
        if (ctx) {
          token.roleId = ctx.roleId;
          token.roleCode = ctx.roleCode;
          token.permissions = ctx.permissions;
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
      }
      return session;
    },
  },
};
