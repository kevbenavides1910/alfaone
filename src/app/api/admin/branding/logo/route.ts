import { NextRequest } from "next/server";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canManageCatalogsSession } from "@/lib/api/middleware";
import { created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";
import {
  absoluteBrandingFile,
  ALLOWED_LOGO_MIMES,
  MAX_LOGO_BYTES,
  relativeLogoPath,
  ensureBrandingRow,
} from "@/modules/plataforma/services/app-branding";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageCatalogsSession(session)) return forbidden();

  try {
    const row = await ensureBrandingRow();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    if (blob.size > MAX_LOGO_BYTES) {
      return badRequest(`Logo demasiado grande (máximo ${MAX_LOGO_BYTES / (1024 * 1024)} MB)`);
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const detected = detectMimeFromBuffer(buf);
    const declared = blob.type || "application/octet-stream";

    if (!ALLOWED_LOGO_MIMES.has(detected) && !ALLOWED_LOGO_MIMES.has(declared)) {
      return badRequest("Solo se permiten imágenes PNG, JPEG o WebP");
    }
    if (
      declared !== "application/octet-stream" &&
      !mimeMatchesDeclared(detected, declared)
    ) {
      return badRequest("El contenido del archivo no coincide con el tipo de imagen declarado");
    }

    const mime =
      detected !== "application/octet-stream" && ALLOWED_LOGO_MIMES.has(detected)
        ? detected
        : ALLOWED_LOGO_MIMES.has(declared)
          ? declared
          : detected;

    const rel = relativeLogoPath(mime);
    const abs = absoluteBrandingFile(rel);
    await mkdir(path.dirname(abs), { recursive: true });

    if (row.logoPath && row.logoPath !== rel) {
      try {
        await unlink(absoluteBrandingFile(row.logoPath));
      } catch {
        /* ignore */
      }
    }

    await writeFile(abs, buf);

    const updated = await prisma.appBranding.update({
      where: { id: "default" },
      data: { logoPath: rel },
    });

    return created({
      logoPath: updated.logoPath,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "EACCES" || code === "EPERM") {
      return serverError(
        "No hay permisos de escritura en el directorio de archivos (/data/branding). Contacte al administrador del servidor.",
        e,
      );
    }
    return serverError("Error al subir logo", e);
  }
}
