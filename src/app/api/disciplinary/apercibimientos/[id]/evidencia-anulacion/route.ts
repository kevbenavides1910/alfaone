import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canManageDisciplinary, canViewDisciplinary } from "@/modules/core/permissions";
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import {
  DISCIPLINARY_EVIDENCE_UPLOAD_ROOT,
  isWebStoredEvidencia,
  saveDisciplinaryAnulacionEvidence,
} from "@/modules/disciplinario/services/disciplinary-evidence-uploads";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canViewDisciplinary(session)) return forbidden();

  const { id } = await params;

  try {
    const row = await prisma.disciplinaryApercibimiento.findUnique({
      where: { id },
      select: { evidenciaAnulacion: true },
    });
    if (!row?.evidenciaAnulacion || !isWebStoredEvidencia(row.evidenciaAnulacion)) {
      return notFound("Evidencia no encontrada");
    }

    const abs = resolveUnderRoot(DISCIPLINARY_EVIDENCE_UPLOAD_ROOT, row.evidenciaAnulacion);
    if (!abs) return notFound();
    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    const fileName = path.basename(abs);
    const ext = path.extname(fileName).toLowerCase();
    const mimeByExt: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".csv": "text/csv",
    };
    const mime = mimeByExt[ext] ?? "application/octet-stream";

    return new Response(buf, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return serverError("Error al descargar evidencia", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageDisciplinary(session)) return forbidden();

  const { id } = await params;

  try {
    const existing = await prisma.disciplinaryApercibimiento.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });
    if (!existing) return notFound("Apercibimiento no encontrado");
    if (existing.estado !== "ANULADO") {
      return badRequest("Solo se puede adjuntar evidencia a apercibimientos anulados");
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const saved = await saveDisciplinaryAnulacionEvidence(id, file as File);
    if ("error" in saved) return badRequest(saved.error);

    await prisma.disciplinaryApercibimiento.update({
      where: { id },
      data: { evidenciaAnulacion: saved.path },
    });

    return ok({
      evidenciaDescargable: true,
      evidenciaUrl: `/api/disciplinary/apercibimientos/${id}/evidencia-anulacion`,
      fileName: saved.fileName,
    });
  } catch (e) {
    return serverError("Error al subir evidencia", e);
  }
}
