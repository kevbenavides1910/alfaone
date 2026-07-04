import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api/response";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { signImpersonationToken } from "@/lib/auth/impersonation-token";
import { prisma } from "@/modules/core/db/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden("Solo administradores pueden ingresar como otro usuario");

  const { id: targetUserId } = await params;
  if (targetUserId === session.user.id) {
    return badRequest("No puede ingresar como su propio usuario");
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true, name: true },
    });
    if (!target) return notFound("Usuario no encontrado");
    if (!target.isActive) return badRequest("No puede ingresar como un usuario inactivo");

    const token = signImpersonationToken({
      adminId: session.user.id,
      targetUserId,
    });

    const url = `/auth/impersonate?token=${encodeURIComponent(token)}`;
    return ok({ url, targetName: target.name });
  } catch (e) {
    return serverError("Error al preparar ingreso como otro usuario", e);
  }
}
