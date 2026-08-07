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
  relativeDisciplinarySignaturePath,
} from "@/modules/plataforma/services/app-branding";
import { prepareDisciplinarySignaturePng } from "@/modules/disciplinario/services/disciplinary-signature-image";
import { created, badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/api/response";
import { ensureDisciplinarySettingsRow } from "@/modules/disciplinario/services/disciplinary-settings";

/** Solo PNG/JPEG: el motor PDF no incrusta WebP. */
const SIGNATURE_MIMES = new Set(["image/png", "image/jpeg"]);

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "disciplinario.ajustes", "view")) return forbidden();

  try {
    await ensureDisciplinarySettingsRow();
    const row = await prisma.appDisciplinarySettings.findUnique({ where: { id: "default" } });
    const rel = row?.documentSignaturePath?.trim();
    if (!rel) return notFound("Sin firma configurada");

    const abs = absoluteBrandingFile(rel);
    const buf = await readFile(abs);
    const prepared = await prepareDisciplinarySignaturePng(new Uint8Array(buf));
    if (prepared?.length) {
      // Migra JPEG/recuadro antiguo a PNG limpio en disco (una sola vez).
      const pngRel = relativeDisciplinarySignaturePath("image/png");
      if (rel !== pngRel || !rel.toLowerCase().endsWith(".png")) {
        try {
          const pngAbs = absoluteBrandingFile(pngRel);
          await mkdir(path.dirname(pngAbs), { recursive: true });
          await writeFile(pngAbs, Buffer.from(prepared));
          await prisma.appDisciplinarySettings.update({
            where: { id: "default" },
            data: { documentSignaturePath: pngRel },
          });
          if (rel !== pngRel) {
            try {
              await unlink(abs);
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* servir en memoria aunque falle la migración */
        }
      }
      return new NextResponse(Buffer.from(prepared), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    const mime = mimeForLogoPath(rel);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return notFound("Archivo de firma no encontrado");
    return serverError("Error al servir firma", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "disciplinario.ajustes", "admin")) return forbidden();

  try {
    const row = await ensureDisciplinarySettingsRow();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    if (blob.size > MAX_LOGO_BYTES) return badRequest("Imagen demasiado grande (máximo 2 MB)");
    const mime = blob.type || "application/octet-stream";
    if (!SIGNATURE_MIMES.has(mime)) {
      return badRequest("Use PNG o JPEG para la firma (así se verá correctamente en el PDF)");
    }

    const raw = new Uint8Array(await blob.arrayBuffer());
    const prepared = await prepareDisciplinarySignaturePng(raw);
    if (!prepared?.length) {
      return badRequest(
        "No se detectó tinta en la imagen. Use una firma sobre fondo blanco o transparente.",
      );
    }

    // Siempre PNG limpio (fondo transparente + recorte).
    const rel = relativeDisciplinarySignaturePath("image/png");
    const abs = absoluteBrandingFile(rel);
    await mkdir(path.dirname(abs), { recursive: true });

    if (row.documentSignaturePath && row.documentSignaturePath !== rel) {
      try {
        await unlink(absoluteBrandingFile(row.documentSignaturePath));
      } catch {
        /* ignore */
      }
    }

    await writeFile(abs, Buffer.from(prepared));

    const updated = await prisma.appDisciplinarySettings.update({
      where: { id: "default" },
      data: { documentSignaturePath: rel },
    });

    return created({
      documentSignaturePath: updated.documentSignaturePath,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al subir firma", e);
  }
}
