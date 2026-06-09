import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { badRequest, unauthorized, forbidden, serverError, created } from "@/lib/api/response";
import { uploadSigNewVersion, updateSigSameVersion } from "@/modules/sig/services/document-versions";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";
import { ALLOWED_SIG_DOCUMENT_MIMES, MAX_SIG_DOCUMENT_BYTES } from "@/modules/sig/services/document-uploads";

type Ctx = { params: Promise<{ id: string }> };

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const form = await req.formData();
  const mode = form.get("mode");

  try {
    if (mode === "same_version") {
      if (!hasPermission(session, "sig.documentos", "admin")) return forbidden();

      const revisionDate = parseDate(form.get("revisionDate"));
      const effectiveFrom = parseDate(form.get("effectiveFrom"));
      const effectiveUntilRaw = form.get("effectiveUntil");
      const effectiveUntil =
        effectiveUntilRaw === "" || effectiveUntilRaw === null
          ? null
          : parseDate(effectiveUntilRaw);

      const version = await updateSigSameVersion(id, session.user.id, {
        revisionDate: revisionDate ?? undefined,
        effectiveFrom: effectiveFrom ?? undefined,
        effectiveUntil: effectiveUntilRaw !== null ? effectiveUntil : undefined,
        changeSummary:
          typeof form.get("changeSummary") === "string"
            ? (form.get("changeSummary") as string)
            : null,
      });

      return created({
        ...version,
        revisionDate: version.revisionDate.toISOString(),
        effectiveFrom: version.effectiveFrom.toISOString(),
        effectiveUntil: version.effectiveUntil?.toISOString() ?? null,
        createdAt: version.createdAt.toISOString(),
      });
    }

    if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido para nueva versión");

    const blob = file as File;
    if (blob.size > MAX_SIG_DOCUMENT_BYTES) return badRequest("Archivo demasiado grande (máximo 50 MB)");

    const buf = Buffer.from(await blob.arrayBuffer());
    const detected = detectMimeFromBuffer(buf);
    const declared = blob.type || "application/octet-stream";
    if (!ALLOWED_SIG_DOCUMENT_MIMES.has(declared)) return badRequest("Tipo de archivo no permitido");
    if (!mimeMatchesDeclared(detected, declared)) {
      return badRequest("El contenido del archivo no coincide con el tipo declarado");
    }
    const mime = detected !== "application/octet-stream" ? detected : declared;

    const revisionDate = parseDate(form.get("revisionDate"));
    const effectiveFrom = parseDate(form.get("effectiveFrom"));
    if (!revisionDate || !effectiveFrom) {
      return badRequest("Fechas de revisión y vigencia requeridas");
    }

    const assignedApproverId = form.get("assignedApproverId");
    if (typeof assignedApproverId !== "string" || !assignedApproverId.trim()) {
      return badRequest("Aprobador asignado requerido");
    }

    const version = await uploadSigNewVersion(id, session.user.id, {
      versionLabel:
        typeof form.get("versionLabel") === "string" ? (form.get("versionLabel") as string) : undefined,
      revisionDate,
      effectiveFrom,
      effectiveUntil: parseDate(form.get("effectiveUntil")),
      changeSummary:
        typeof form.get("changeSummary") === "string" ? (form.get("changeSummary") as string) : null,
      assignedApproverId: assignedApproverId.trim(),
      file: {
        buffer: buf,
        fileName: blob.name || "documento",
        mimeType: mime,
        size: blob.size,
      },
    });

    return created({
      ...version,
      revisionDate: version.revisionDate.toISOString(),
      effectiveFrom: version.effectiveFrom.toISOString(),
      effectiveUntil: version.effectiveUntil?.toISOString() ?? null,
      createdAt: version.createdAt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar versión";
    if (
      msg.includes("no encontrado") ||
      msg.includes("obsoleto") ||
      msg.includes("aprobada") ||
      msg.includes("permitido") ||
      msg.includes("aprobador")
    ) {
      return badRequest(msg);
    }
    return serverError("Error al gestionar versión", e);
  }
}
