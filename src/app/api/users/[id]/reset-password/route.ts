import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api/response";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { DEFAULT_RESET_PASSWORD } from "@/lib/security/password-policy";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ id: string }> };

/** Restablece contraseña a la temporal y obliga cambio en el próximo ingreso. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden();

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return notFound();
  if (!user.isActive) return badRequest("No se puede restablecer la contraseña de un usuario inactivo");

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 12);
    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, updatedAt: new Date() },
    });

    return ok({
      message: `Contraseña restablecida. El usuario debe ingresar con la contraseña temporal y elegir una nueva.`,
      temporaryPassword: DEFAULT_RESET_PASSWORD,
    });
  } catch (e) {
    return serverError("Error al restablecer contraseña", e);
  }
}
