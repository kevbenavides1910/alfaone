import { NextRequest } from "next/server";
import type { SigChangeRequestStatus, SigChangeRequestType } from "@prisma/client";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from "@/lib/api/response";
import {
  createSigChangeRequest,
  listSigChangeRequests,
  reviewSigChangeRequest,
} from "@/modules/sig/services/change-requests";

type Ctx = { params: Promise<{ id: string }> };

function serialize(row: Awaited<ReturnType<typeof listSigChangeRequests>>[number]) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  const status = req.nextUrl.searchParams.get("status") as SigChangeRequestStatus | "ALL" | null;
  try {
    const rows = await listSigChangeRequests(id, { status: status ?? "ALL" });
    return ok(rows.map(serialize));
  } catch (e) {
    return serverError("Error al listar solicitudes", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    if (body?.action === "review") {
      if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();
      const requestId = typeof body.requestId === "string" ? body.requestId : "";
      const reviewAction = body.reviewAction as "ACCEPT" | "REJECT" | "CANCEL";
      if (!requestId || !["ACCEPT", "REJECT", "CANCEL"].includes(reviewAction)) {
        return badRequest("requestId y reviewAction requeridos");
      }
      const updated = await reviewSigChangeRequest(
        id,
        requestId,
        session.user.id,
        reviewAction,
        typeof body.reviewerNote === "string" ? body.reviewerNote : null
      );
      return ok(serialize(updated));
    }

    const description = typeof body.description === "string" ? body.description : "";
    if (!description.trim()) return badRequest("description es requerido");

    const type = (body.type as SigChangeRequestType) || "GENERAL";
    const validTypes: SigChangeRequestType[] = ["GENERAL", "EDIT_STAGE", "ADD_STAGE", "REMOVE_STAGE"];
    if (!validTypes.includes(type)) return badRequest("type inválido");

    const row = await createSigChangeRequest(id, session.user.id, {
      type,
      description,
      targetStageId: typeof body.targetStageId === "string" ? body.targetStageId : null,
      proposedTitle: typeof body.proposedTitle === "string" ? body.proposedTitle : null,
      proposedBody: typeof body.proposedBody === "string" ? body.proposedBody : null,
    });
    return created(serialize(row));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (
      msg.includes("Describa") ||
      msg.includes("etapa") ||
      msg.includes("obsoleto") ||
      msg.includes("no encontrada") ||
      msg.includes("cerrada") ||
      msg.includes("rechazo")
    ) {
      return badRequest(msg);
    }
    return serverError("Error en solicitudes de cambio", e);
  }
}
