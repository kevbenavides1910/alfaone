import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { sendPlatformMail } from "@/lib/email/platform-mailer";
import { APP_NAME } from "@/modules/plataforma/branding-constants";

const schema = z.object({
  email: z.string().email("Correo inválido"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("JSON inválido"); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Correo inválido");

  const { email } = parsed.data;

  // Respuesta genérica siempre (no revelar si el correo existe)
  const GENERIC_OK = ok({ message: "Si el correo está registrado, recibirás las instrucciones." });

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive) return GENERIC_OK;

    // Token seguro: 32 bytes aleatorios, almacenamos el SHA-256
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpiresAt: expiresAt },
    });

    const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
    const resetLink = `${origin}/reset-password?token=${rawToken}`;

    await sendPlatformMail({
      to: user.email,
      subject: `${APP_NAME} — Restablecer contraseña`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #dc2626;">Restablecer contraseña</h2>
          <p>Hola <strong>${user.name}</strong>,</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${APP_NAME}</strong>.</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}"
               style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Restablecer contraseña
            </a>
          </p>
          <p style="font-size:13px;color:#6b7280;">
            El enlace expira en <strong>1 hora</strong>.
            Si no solicitaste este cambio, ignora este mensaje.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:12px;color:#9ca3af;">${APP_NAME} · Grupo Corporativo Alfa</p>
        </div>
      `,
      text: `Hola ${user.name},\n\nRestablece tu contraseña en:\n${resetLink}\n\nEl enlace expira en 1 hora.`,
    });

    return GENERIC_OK;
  } catch (e) {
    return serverError("Error interno del servidor", e);
  }
}
