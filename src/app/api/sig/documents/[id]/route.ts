import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/response";
import {
  getSigDocumentDetail,
  updateSigDocumentMetadata,
} from "@/modules/sig/services/documents";
import { markSigDocumentObsolete } from "@/modules/sig/services/document-approval";

type Ctx = { params: Promise<{ id: string }> };

function serializeDetail(doc: NonNullable<Awaited<ReturnType<typeof getSigDocumentDetail>>>) {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    currentVersion: doc.currentVersion
      ? {
          ...doc.currentVersion,
          revisionDate: doc.currentVersion.revisionDate.toISOString(),
          effectiveFrom: doc.currentVersion.effectiveFrom.toISOString(),
          effectiveUntil: doc.currentVersion.effectiveUntil?.toISOString() ?? null,
          approvedAt: doc.currentVersion.approvedAt?.toISOString() ?? null,
          createdAt: doc.currentVersion.createdAt.toISOString(),
          downloadUrl: `/api/sig/documents/${doc.id}/download?versionId=${doc.currentVersion.id}`,
        }
      : null,
    versions: doc.versions.map((v) => ({
      ...v,
      revisionDate: v.revisionDate.toISOString(),
      effectiveFrom: v.effectiveFrom.toISOString(),
      effectiveUntil: v.effectiveUntil?.toISOString() ?? null,
      approvedAt: v.approvedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
      downloadUrl: `/api/sig/documents/${doc.id}/download?versionId=${v.id}`,
    })),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  try {
    const doc = await getSigDocumentDetail(id);
    if (!doc) return notFound();
    return ok(serializeDetail(doc));
  } catch (e) {
    return serverError("Error al obtener documento", e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    if (body.action === "obsolete") {
      if (!hasPermission(session, "sig.documentos", "admin")) return forbidden();
      await markSigDocumentObsolete(id, session.user.id, body.notes);
      const doc = await getSigDocumentDetail(id);
      if (!doc) return notFound();
      return ok(serializeDetail(doc));
    }

    const updated = await updateSigDocumentMetadata(id, session.user.id, {
      title: typeof body.title === "string" ? body.title : undefined,
      documentTypeId: body.documentTypeId !== undefined ? body.documentTypeId : undefined,
      processId: body.processId !== undefined ? body.processId : undefined,
      company: body.company !== undefined ? body.company : undefined,
      revisionIntervalDays:
        body.revisionIntervalDays !== undefined ? body.revisionIntervalDays : undefined,
    });

    return ok({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al actualizar documento", e);
  }
}
