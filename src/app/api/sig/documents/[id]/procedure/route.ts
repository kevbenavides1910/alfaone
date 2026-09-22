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
import type { AlfaSectionKey } from "@/modules/sig/business/procedure-sections";

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

async function parsePublishBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    const payloadRaw = fd.get("payload");
    if (typeof payloadRaw !== "string") throw new Error("payload JSON requerido");
    const body = JSON.parse(payloadRaw) as Record<string, unknown>;
    const file = fd.get("flowchart");
    let flowchart: ProcedureBodyInput["flowchart"] = null;
    if (file && typeof file !== "string" && "arrayBuffer" in file) {
      const buf = Buffer.from(await file.arrayBuffer());
      flowchart = {
        buffer: buf,
        fileName: file.name || "diagrama.png",
        mimeType: file.type || "image/png",
        size: buf.length,
      };
    }
    return { body, flowchart };
  }
  const body = (await req.json()) as Record<string, unknown>;
  return { body, flowchart: null as null };
}

type ProcedureBodyInput = {
  flowchart?: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    size: number;
  } | null;
};

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  const { id } = await params;
  try {
    const { body, flowchart } = await parsePublishBody(req);
    if (!body?.changeSummary || typeof body.changeSummary !== "string") {
      return badRequest("changeSummary es requerido");
    }
    if (!body?.assignedApproverId || typeof body.assignedApproverId !== "string") {
      return badRequest("assignedApproverId es requerido");
    }

    const stages = Array.isArray(body.stages)
      ? body.stages.map(
          (s: {
            title?: string;
            body?: string;
            responsible?: string;
            sectionKey?: string;
          }) => ({
            title: String(s.title ?? ""),
            body: String(s.body ?? ""),
            responsible: s.responsible ?? null,
            sectionKey: (s.sectionKey as AlfaSectionKey) || null,
          })
        )
      : [];

    const activities = Array.isArray(body.activities)
      ? body.activities.map(
          (a: {
            code?: string;
            name?: string;
            description?: string;
            documents?: string;
            responsible?: string;
          }) => ({
            code: String(a.code ?? ""),
            name: String(a.name ?? ""),
            description: String(a.description ?? ""),
            documents: a.documents ?? null,
            responsible: a.responsible ?? null,
          })
        )
      : [];

    if (!stages.length && !activities.length) {
      return badRequest("Debe incluir secciones o actividades");
    }

    const result = await publishProcedureContentVersion(id, session.user.id, {
      objective: (body.objective as string) ?? null,
      scope: (body.scope as string) ?? null,
      responsibilities: (body.responsibilities as string) ?? null,
      definitions: (body.definitions as string) ?? null,
      stages,
      activities,
      changeSummary: body.changeSummary as string,
      assignedApproverId: body.assignedApproverId as string,
      versionLabel: typeof body.versionLabel === "string" ? body.versionLabel : null,
      changeRequestIds: Array.isArray(body.changeRequestIds)
        ? body.changeRequestIds.filter((x: unknown) => typeof x === "string")
        : [],
      flowchart,
      clearFlowchart: body.clearFlowchart === true,
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
      msg.includes("sección") ||
      msg.includes("actividad") ||
      msg.includes("resumen") ||
      msg.includes("obsoleto") ||
      msg.includes("no encontrado") ||
      msg.includes("versión") ||
      msg.includes("diagrama") ||
      msg.includes("payload")
    ) {
      return badRequest(msg);
    }
    return serverError("Error al publicar procedimiento", e);
  }
}
