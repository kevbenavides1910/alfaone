import { NextRequest } from "next/server";
import { getEffectiveSession } from "@/lib/impersonation/server";
import { created, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getRolePermissions } from "@/lib/permissions/resolve";
import { prisma } from "@/modules/core/db/prisma";
import { verifyImpersonationToken } from "@/lib/impersonation/verify-token";
import { userIsPlatformAdmin } from "@/modules/core/auth/impersonation-admin";

/** Devuelve permisos del rol en vista previa (token en Authorization: Bearer o body.token). */
export async function POST(req: NextRequest) {
  const session = await getEffectiveSession();
  if (!session) return unauthorized();

  try {
    let token: string | null = null;
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7).trim();
    }
    if (!token) {
      const body = (await req.json().catch(() => null)) as { token?: string } | null;
      token = body?.token?.trim() ?? null;
    }
    if (!token) return forbidden("Token de vista previa requerido");

    const payload = await verifyImpersonationToken(token);
    if (!payload || payload.sub !== session.user.id) {
      return forbidden("Token de vista previa inválido");
    }

    const isAdmin = await userIsPlatformAdmin(session.user.id);
    if (!isAdmin) return forbidden();

    const role = await prisma.role.findUnique({
      where: { id: payload.impersonatedRoleId },
      select: { id: true, code: true },
    });
    if (!role) return forbidden("Rol no encontrado");

    const permissions = await getRolePermissions(role.id);
    return created({
      roleId: role.id,
      roleCode: role.code,
      permissions,
    });
  } catch (e) {
    return serverError("Error al resolver vista previa", e);
  }
}
