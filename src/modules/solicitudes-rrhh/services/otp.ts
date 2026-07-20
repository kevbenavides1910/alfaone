import crypto from "crypto";
import type { HrDocumentRequestSession } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { sendPlatformMail } from "@/lib/email/platform-mailer";
import { APP_NAME } from "@/modules/plataforma/branding-constants";
import type { EmpleoSnapshot } from "@/modules/solicitudes-rrhh/services/empleo-lookup";
import { getHrDocumentSettings } from "@/modules/solicitudes-rrhh/services/settings";
import { HR_TRAMITE_LABELS, type HrTramite } from "@/modules/solicitudes-rrhh/business/tramites";
import { renderTemplate } from "@/modules/solicitudes-rrhh/business/format";

const OTP_TTL_MS = 10 * 60 * 1000;
const DOWNLOAD_TTL_MS = 15 * 60 * 1000;

function sha256(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function parseCcList(raw: string | null | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const list = raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

export async function createOtpSession(input: {
  cedulaNormalizada: string;
  tramite: HrTramite;
  email: string;
  empleo: EmpleoSnapshot;
}): Promise<{ sessionId: string; mailed: boolean }> {
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const settings = await getHrDocumentSettings();
  const tramiteLabel = HR_TRAMITE_LABELS[input.tramite];

  const session = await prisma.hrDocumentRequestSession.create({
    data: {
      cedulaNormalizada: input.cedulaNormalizada,
      tramite: input.tramite,
      email: input.email.toLowerCase().trim(),
      codeHash,
      expiresAt,
      empleoSnapshot: input.empleo,
    },
  });

  const subject = renderTemplate(settings.otpSubjectTemplate, {
    tramite: tramiteLabel,
    codigo: code,
    nombre: input.empleo.nombre,
  });
  const text = renderTemplate(settings.otpBodyTemplate, {
    tramite: tramiteLabel,
    codigo: code,
    nombre: input.empleo.nombre,
  });
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
      <h2 style="color:#1e3a5f;">Código de verificación</h2>
      <p>Solicitud: <strong>${tramiteLabel}</strong></p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:24px 0;">${code}</p>
      <p style="font-size:13px;color:#6b7280;">El código expira en <strong>10 minutos</strong>.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="font-size:12px;color:#9ca3af;">${APP_NAME} · Recursos Humanos</p>
    </div>
  `;

  const mail = await sendPlatformMail({
    to: input.email.toLowerCase().trim(),
    cc: parseCcList(settings.emailFixedCc),
    subject,
    html,
    text,
  });

  return { sessionId: session.id, mailed: mail.ok === true };
}

export async function verifyOtpAndIssueDownloadToken(input: {
  sessionId: string;
  code: string;
}): Promise<{ downloadToken: string } | { error: string }> {
  const session = await prisma.hrDocumentRequestSession.findUnique({
    where: { id: input.sessionId },
  });
  if (!session) return { error: "Sesión no encontrada" };
  if (session.expiresAt.getTime() < Date.now()) return { error: "El código expiró. Solicite uno nuevo." };
  if (session.codeHash !== sha256(input.code.trim())) return { error: "Código incorrecto" };

  const downloadToken = crypto.randomBytes(32).toString("hex");
  const downloadTokenHash = sha256(downloadToken);
  const downloadExpiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);

  await prisma.hrDocumentRequestSession.update({
    where: { id: session.id },
    data: {
      verifiedAt: new Date(),
      downloadTokenHash,
      downloadExpiresAt,
      downloadUsedAt: null,
    },
  });

  return { downloadToken };
}

export async function findDownloadSession(
  downloadToken: string,
): Promise<{ session: HrDocumentRequestSession } | { error: string }> {
  const hash = sha256(downloadToken);
  const session = await prisma.hrDocumentRequestSession.findFirst({
    where: { downloadTokenHash: hash },
  });
  if (!session) return { error: "Token inválido" };
  if (!session.verifiedAt) return { error: "Sesión no verificada" };
  if (!session.downloadExpiresAt || session.downloadExpiresAt.getTime() < Date.now()) {
    return { error: "El enlace de descarga expiró" };
  }
  if (session.downloadUsedAt) return { error: "El enlace de descarga ya fue usado" };
  return { session };
}

export async function markDownloadUsed(sessionId: string): Promise<void> {
  await prisma.hrDocumentRequestSession.update({
    where: { id: sessionId },
    data: { downloadUsedAt: new Date() },
  });
}
