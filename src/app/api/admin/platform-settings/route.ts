import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, isAdmin } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";

const patchSchema = z.object({
  notificationEmail: z.string().email("Correo inválido").nullable().optional(),
  smtpHost:   z.string().nullable().optional(),
  smtpPort:   z.number().int().min(1).max(65535).nullable().optional(),
  smtpSecure: z.boolean().nullable().optional(),
  smtpUser:   z.string().nullable().optional(),
  smtpPass:   z.string().nullable().optional(),
  smtpFrom:   z.string().nullable().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  try {
    const row = await prisma.appPlatformSettings.findUnique({ where: { id: "default" } });
    return ok({
      notificationEmail: row?.notificationEmail ?? null,
      smtpHost:   row?.smtpHost ?? null,
      smtpPort:   row?.smtpPort ?? null,
      smtpSecure: row?.smtpSecure ?? null,
      smtpUser:   row?.smtpUser ?? null,
      smtpPass:   row?.smtpPass ? "••••••••" : null,
      smtpFrom:   row?.smtpFrom ?? null,
    });
  } catch (e) {
    return serverError("Error interno del servidor", e);
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("JSON inválido"); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const data = parsed.data;

  try {
    // Si smtpPass viene como "••••••••" (máscara) no actualizar el campo
    const smtpPassUpdate =
      data.smtpPass === undefined
        ? undefined
        : data.smtpPass === "••••••••"
          ? undefined
          : data.smtpPass;

    const row = await prisma.appPlatformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        notificationEmail: data.notificationEmail ?? null,
        smtpHost:   data.smtpHost ?? null,
        smtpPort:   data.smtpPort ?? null,
        smtpSecure: data.smtpSecure ?? null,
        smtpUser:   data.smtpUser ?? null,
        smtpPass:   smtpPassUpdate ?? null,
        smtpFrom:   data.smtpFrom ?? null,
      },
      update: {
        ...(data.notificationEmail !== undefined && { notificationEmail: data.notificationEmail }),
        ...(data.smtpHost   !== undefined && { smtpHost:   data.smtpHost }),
        ...(data.smtpPort   !== undefined && { smtpPort:   data.smtpPort }),
        ...(data.smtpSecure !== undefined && { smtpSecure: data.smtpSecure }),
        ...(data.smtpUser   !== undefined && { smtpUser:   data.smtpUser }),
        ...(smtpPassUpdate  !== undefined && { smtpPass:   smtpPassUpdate }),
        ...(data.smtpFrom   !== undefined && { smtpFrom:   data.smtpFrom }),
      },
    });

    return ok({
      notificationEmail: row.notificationEmail,
      smtpHost:   row.smtpHost,
      smtpPort:   row.smtpPort,
      smtpSecure: row.smtpSecure,
      smtpUser:   row.smtpUser,
      smtpPass:   row.smtpPass ? "••••••••" : null,
      smtpFrom:   row.smtpFrom,
    });
  } catch (e) {
    return serverError("Error interno del servidor", e);
  }
}
