import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  created,
  serverError,
} from "@/lib/api/response";
import {
  acknowledgeSigDocumentRead,
  createSigReadCampaign,
  listPendingSigReadAcks,
  supersedeSigDocument,
} from "@/modules/sig/services/document-lifecycle";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  try {
    const rows = await listPendingSigReadAcks(session.user.id);
    return ok({
      rows: rows.map((r) => ({
        ...r,
        dueDate: r.dueDate?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    return serverError("Error al listar lecturas pendientes", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json();

    if (body?.action === "acknowledge") {
      if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();
      const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
      if (!campaignId) return badRequest("campaignId requerido");
      const ack = await acknowledgeSigDocumentRead({
        campaignId,
        userId: session.user.id,
        note: typeof body.note === "string" ? body.note : null,
      });
      return ok({
        ...ack,
        acknowledgedAt: ack.acknowledgedAt.toISOString(),
      });
    }

    if (body?.action === "create-campaign") {
      if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();
      const documentId = typeof body.documentId === "string" ? body.documentId : "";
      const assigneeUserIds = Array.isArray(body.assigneeUserIds)
        ? body.assigneeUserIds.filter((x: unknown) => typeof x === "string")
        : [];
      if (!documentId) return badRequest("documentId requerido");
      const campaign = await createSigReadCampaign({
        documentId,
        actorId: session.user.id,
        title: typeof body.title === "string" ? body.title : undefined,
        versionId: typeof body.versionId === "string" ? body.versionId : null,
        supersedesDocumentId:
          typeof body.supersedesDocumentId === "string" ? body.supersedesDocumentId : null,
        dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
        assigneeUserIds,
      });
      return created(campaign);
    }

    if (body?.action === "supersede") {
      if (!hasPermission(session, "sig.documentos", "admin")) return forbidden();
      const documentId = typeof body.documentId === "string" ? body.documentId : "";
      const supersededById =
        typeof body.supersededById === "string" ? body.supersededById : "";
      if (!documentId || !supersededById) {
        return badRequest("documentId y supersededById requeridos");
      }
      const result = await supersedeSigDocument(documentId, session.user.id, {
        supersededById,
        reason: typeof body.reason === "string" ? body.reason : null,
        assigneeUserIds: Array.isArray(body.assigneeUserIds)
          ? body.assigneeUserIds.filter((x: unknown) => typeof x === "string")
          : [],
        createReadCampaign: body.createReadCampaign !== false,
        readDueDate: typeof body.readDueDate === "string" ? body.readDueDate : null,
      });
      return ok(result);
    }

    return badRequest("action inválida");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (
      msg.includes("no encontrado") ||
      msg.includes("sustitu") ||
      msg.includes("asignado") ||
      msg.includes("destinatario")
    ) {
      return badRequest(msg);
    }
    return serverError("Error en lecturas/acuses SIG", e);
  }
}
