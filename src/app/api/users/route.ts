import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { ok, created, badRequest, unauthorized, forbidden, conflict, serverError } from "@/lib/api/response";
import { listUsersForAdmin } from "@/modules/plataforma/services/list-users";
import { requireCompanyCode } from "@/modules/core/services/companies";
import { normalizeUserRole } from "@/modules/plataforma/services/list-users";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordSchema } from "@/lib/security/password-policy";

const createSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email inválido"),
  password: passwordSchema,
  roleId: z.string().min(1, "Rol requerido"),
  company: z.string().optional().nullable(),
});

async function legacyRoleFromRoleId(roleId: string): Promise<UserRole> {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Rol no encontrado");
  return normalizeUserRole(role.code);
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { isPlatformAdmin, hasPermission } = await import("@/lib/permissions/check");
    if (!isPlatformAdmin(session) && !hasPermission(session, "plataforma.users", "view")) {
      return forbidden();
    }

    const users = await listUsersForAdmin(prisma);

    return ok(users);
  } catch (e) {
    return serverError("Error al listar usuarios", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const { name, email, password, roleId, company } = parsed.data;

    if (company) {
      const companyOk = await requireCompanyCode(prisma, company, { mustBeActive: true });
      if (!companyOk.ok) return badRequest(companyOk.message);
    }

    const legacyRole = await legacyRoleFromRoleId(roleId);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return conflict("Ya existe un usuario con ese email");

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: legacyRole,
        roleId,
        company: company || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roleId: true,
        roleEntity: { select: { name: true, code: true } },
        company: true,
        isActive: true,
        createdAt: true,
      },
    });

    return created({
      ...user,
      roleName: user.roleEntity?.name ?? null,
      roleCode: user.roleEntity?.code ?? null,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear usuario";
    return serverError(msg, e);
  }
}
