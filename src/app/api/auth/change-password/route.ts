import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/response";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordSchema } from "@/lib/security/password-policy";

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Datos inválidos");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true, mustChangePassword: true },
    });
    if (!user?.passwordHash) return badRequest("Usuario sin contraseña configurada");

    const { currentPassword, newPassword } = parsed.data;

    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return badRequest("Indique su contraseña actual");
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return badRequest("Contraseña actual incorrecta");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash, mustChangePassword: false, updatedAt: new Date() },
    });

    return ok({ message: "Contraseña actualizada correctamente" });
  } catch (e) {
    return serverError("Error al cambiar contraseña", e);
  }
}
