import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  absoluteBrandingFile,
  MAX_LOGO_BYTES,
  mimeForLogoPath,
  relativeHrDocumentSignaturePath,
} from "@/modules/plataforma/services/app-branding";
import { created, badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/api/response";
import { ensureHrDocumentSettingsRow } from "@/modules/solicitudes-rrhh/services/settings";

const SIGNATURE_MIMES = new Set(["image/png", "image/jpeg"]);

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "solicitudesRrhh.ajustes", "view")) return forbidden();

  try {
    await ensureHrDocumentSettingsRow();
    const row = await prisma.hrDocumentRequestSettings.findUnique({ where: { id: "default" } });
    const rel = row?.documentSignaturePath?.trim();
    if (!rel) return notFound("Sin firma configurada");

    const abs = absoluteBrandingFile(rel);
    const buf = await readFile(abs);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeForLogoPath(rel),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return notFound("Archivo de firma no encontrado");
    return serverError("Error al servir firma RRHH", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "solicitudesRrhh.ajustes", "edit")) return forbidden();

  try {
    const row = await ensureHrDocumentSettingsRow();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    if (blob.size > MAX_LOGO_BYTES) return badRequest("Imagen demasiado grande (máximo 2 MB)");
    const mime = blob.type || "application/octet-stream";
    if (!SIGNATURE_MIMES.has(mime)) {
      return badRequest("Use PNG o JPEG para la firma (así se verá correctamente en el PDF)");
    }

    const rel = relativeHrDocumentSignaturePath(mime);
    const abs = absoluteBrandingFile(rel);
    await mkdir(path.dirname(abs), { recursive: true });

    if (row.documentSignaturePath && row.documentSignaturePath !== rel) {
      try {
        await unlink(absoluteBrandingFile(row.documentSignaturePath));
      } catch {
        /* ignore */
      }
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    await writeFile(abs, buf);

    const updated = await prisma.hrDocumentRequestSettings.update({
      where: { id: "default" },
      data: { documentSignaturePath: rel },
    });

    return created({
      documentSignaturePath: updated.documentSignaturePath,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al subir firma RRHH", e);
  }
}
