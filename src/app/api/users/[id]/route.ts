import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordSchema } from "@/lib/security/password-policy";
import { requireCompanyCode } from "@/modules/core/services/companies";
import { normalizeUserRole } from "@/modules/plataforma/services/list-users";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  roleId: z.string().optional(),
  company: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { isPlatformAdmin } = await import("@/lib/permissions/check");
  if (!isPlatformAdmin(session)) return forbidden();

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return notFound();

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const { password, roleId, ...rest } = parsed.data;
    if (rest.company) {
      const companyOk = await requireCompanyCode(prisma, rest.company, { mustBeActive: true });
      if (!companyOk.ok) return badRequest(companyOk.message);
    }
    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
      data.mustChangePassword = true;
    }
    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) return badRequest("Rol no encontrado");
      data.roleId = roleId;
      data.role = normalizeUserRole(role.code);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: data as never,
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

    return ok({
      ...updated,
      roleName: updated.roleEntity?.name ?? null,
      roleCode: updated.roleEntity?.code ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al actualizar usuario", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { isPlatformAdmin } = await import("@/lib/permissions/check");
  if (!isPlatformAdmin(session)) return forbidden();

  const { id } = await params;
  if (id === session.user.id) {
    return badRequest("No podés desactivar tu propio usuario");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return notFound();

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  return ok({ message: "Usuario desactivado" });
}
