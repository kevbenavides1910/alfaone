import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { approveSigDocument, rejectSigDocument } from "@/modules/sig/services/document-approval";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.aprobaciones", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const versionId = typeof body.versionId === "string" ? body.versionId : null;
    if (!versionId) return badRequest("versionId requerido");

    const doc = await approveSigDocument(
      id,
      versionId,
      session.user.id,
      typeof body.notes === "string" ? body.notes : null
    );

    return ok({
      id: doc.id,
      status: doc.status,
      currentVersion: doc.currentVersion
        ? {
            id: doc.currentVersion.id,
            versionLabel: doc.currentVersion.versionLabel,
            approvedAt: doc.currentVersion.approvedAt?.toISOString() ?? null,
            approvedBy: doc.currentVersion.approvedBy,
          }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al aprobar";
    if (msg.includes("no encontrad") || msg.includes("aprobador")) return badRequest(msg);
    return serverError("Error al aprobar documento", e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.aprobaciones", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const versionId = typeof body.versionId === "string" ? body.versionId : null;
    const note = typeof body.rejectionNote === "string" ? body.rejectionNote.trim() : "";
    if (!versionId) return badRequest("versionId requerido");
    if (!note) return badRequest("Motivo de rechazo requerido");

    const result = await rejectSigDocument(id, versionId, session.user.id, note);
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al rechazar";
    if (msg.includes("no encontrad") || msg.includes("aprobador")) return badRequest(msg);
    return serverError("Error al rechazar documento", e);
  }
}
