import { NextRequest } from "next/server";
import { SigDocumentStatus } from "@prisma/client";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, created } from "@/lib/api/response";
import { listSigDocuments } from "@/modules/sig/services/documents-list";
import { createSigDocument } from "@/modules/sig/services/documents";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";
import { ALLOWED_SIG_DOCUMENT_MIMES, MAX_SIG_DOCUMENT_BYTES } from "@/modules/sig/services/document-uploads";

function parseDate(value: FormDataEntryValue | null, field: string): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} inválida`);
  return d;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const statusRaw = sp.get("status");
    const result = await listSigDocuments({
      q: sp.get("q") ?? undefined,
      documentTypeId: sp.get("documentTypeId") ?? undefined,
      processId: sp.get("processId") ?? undefined,
      company: sp.get("company") ?? undefined,
      status:
        statusRaw && Object.values(SigDocumentStatus).includes(statusRaw as SigDocumentStatus)
          ? (statusRaw as SigDocumentStatus)
          : undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 25,
    });

    return ok({
      ...result,
      rows: result.rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        currentVersion: r.currentVersion
          ? {
              ...r.currentVersion,
              revisionDate: r.currentVersion.revisionDate.toISOString(),
              effectiveFrom: r.currentVersion.effectiveFrom.toISOString(),
              effectiveUntil: r.currentVersion.effectiveUntil?.toISOString() ?? null,
              approvedAt: r.currentVersion.approvedAt?.toISOString() ?? null,
              downloadUrl: `/api/sig/documents/${r.id}/download?versionId=${r.currentVersion.id}`,
              previewUrl: `/api/sig/documents/${r.id}/download?versionId=${r.currentVersion.id}&inline=1`,
              canPreview:
                r.currentVersion.mimeType === "application/pdf" ||
                r.currentVersion.mimeType.startsWith("image/"),
            }
          : null,
      })),
    });
  } catch (e) {
    return serverError("Error al listar documentos SIG", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    if (blob.size > MAX_SIG_DOCUMENT_BYTES) {
      return badRequest("Archivo demasiado grande (máximo 50 MB)");
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const detected = detectMimeFromBuffer(buf);
    const declared = blob.type || "application/octet-stream";
    if (!ALLOWED_SIG_DOCUMENT_MIMES.has(declared)) {
      return badRequest("Tipo de archivo no permitido");
    }
    if (!mimeMatchesDeclared(detected, declared)) {
      return badRequest("El contenido del archivo no coincide con el tipo declarado");
    }
    const mime = detected !== "application/octet-stream" ? detected : declared;

    const code = form.get("code");
    const title = form.get("title");
    const documentTypeId = form.get("documentTypeId");
    if (typeof code !== "string" || !code.trim()) return badRequest("Código requerido");
    if (typeof title !== "string" || !title.trim()) return badRequest("Título requerido");
    if (typeof documentTypeId !== "string" || !documentTypeId.trim()) {
      return badRequest("Tipo documental requerido");
    }

    const revisionDate = parseDate(form.get("revisionDate"), "Fecha de revisión");
    const effectiveFrom = parseDate(form.get("effectiveFrom"), "Vigencia desde");
    if (!revisionDate || !effectiveFrom) {
      return badRequest("Fechas de revisión y vigencia requeridas");
    }

    const effectiveUntil = parseDate(form.get("effectiveUntil"), "Vigencia hasta");
    const processId = form.get("processId");
    const company = form.get("company");
    const intervalRaw = form.get("revisionIntervalDays");
    const interval =
      typeof intervalRaw === "string" && intervalRaw.trim()
        ? Number(intervalRaw)
        : null;
    const assignedApproverId = form.get("assignedApproverId");
    if (typeof assignedApproverId !== "string" || !assignedApproverId.trim()) {
      return badRequest("Aprobador asignado requerido");
    }

    const doc = await createSigDocument(
      {
        code,
        title,
        documentTypeId,
        processId: typeof processId === "string" && processId.trim() ? processId : null,
        company: typeof company === "string" && company.trim() ? company : null,
        revisionIntervalDays: interval && !Number.isNaN(interval) ? interval : null,
        versionLabel: typeof form.get("versionLabel") === "string" ? form.get("versionLabel") as string : "1",
        revisionDate,
        effectiveFrom,
        effectiveUntil,
        changeSummary: typeof form.get("changeSummary") === "string" ? form.get("changeSummary") as string : null,
        assignedApproverId: assignedApproverId.trim(),
        file: {
          buffer: buf,
          fileName: blob.name || "documento",
          mimeType: mime,
          size: blob.size,
        },
      },
      session.user.id
    );

    return created({
      id: doc.id,
      code: doc.code,
      title: doc.title,
      status: doc.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear documento";
    if (msg.includes("Ya existe") || msg.includes("requerido") || msg.includes("permitido") || msg.includes("aprobador")) {
      return badRequest(msg);
    }
    return serverError("Error al crear documento SIG", e);
  }
}
