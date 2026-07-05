import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, serverError } from "@/lib/api/response";

const schema = z.object({
  token:    z.string().min(1, "Token requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("JSON inválido"); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const { token, password } = parsed.data;

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: { gte: new Date() },
        isActive: true,
      },
    });

    if (!user) {
      return badRequest("El enlace es inválido o ha expirado. Solicita uno nuevo.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken:     null,
        passwordResetExpiresAt: null,
        mustChangePassword:     false,
      },
    });

    return ok({ message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (e) {
    return serverError("Error interno del servidor", e);
  }
}
