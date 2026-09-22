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
  getSigProcedureContent,
  publishProcedureContentVersion,
} from "@/modules/sig/services/procedure-content";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  try {
    const data = await getSigProcedureContent(id);
    if (!data) return notFound("Documento no encontrado");
    return ok(data);
  } catch (e) {
    return serverError("Error al obtener procedimiento", e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    if (!body?.changeSummary || typeof body.changeSummary !== "string") {
      return badRequest("changeSummary es requerido");
    }
    if (!body?.assignedApproverId || typeof body.assignedApproverId !== "string") {
      return badRequest("assignedApproverId es requerido");
    }
    if (!Array.isArray(body.stages) || body.stages.length === 0) {
      return badRequest("Debe incluir al menos una etapa");
    }

    const result = await publishProcedureContentVersion(id, session.user.id, {
      objective: body.objective ?? null,
      scope: body.scope ?? null,
      responsibilities: body.responsibilities ?? null,
      definitions: body.definitions ?? null,
      stages: body.stages.map((s: { title?: string; body?: string; responsible?: string }) => ({
        title: String(s.title ?? ""),
        body: String(s.body ?? ""),
        responsible: s.responsible ?? null,
      })),
      changeSummary: body.changeSummary,
      assignedApproverId: body.assignedApproverId,
      versionLabel: typeof body.versionLabel === "string" ? body.versionLabel : null,
      changeRequestIds: Array.isArray(body.changeRequestIds)
        ? body.changeRequestIds.filter((x: unknown) => typeof x === "string")
        : [],
    });

    return ok({
      version: {
        id: result.version.id,
        versionLabel: result.version.versionLabel,
        status: result.version.status,
      },
      procedure: result.procedure,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al publicar procedimiento";
    if (
      msg.includes("aprobador") ||
      msg.includes("etapa") ||
      msg.includes("resumen") ||
      msg.includes("obsoleto") ||
      msg.includes("no encontrado") ||
      msg.includes("versión")
    ) {
      return badRequest(msg);
    }
    return serverError("Error al publicar procedimiento", e);
  }
}
