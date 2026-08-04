import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/response";
import { createSigEvidence, listSigEvidences } from "@/modules/sig";
import { createEvidenceSchema } from "@/modules/sig/validations/evidences.schema";
import type { SigEvidenceStatus, SigEvidenceType } from "@prisma/client";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

function canViewEvidence(session: Parameters<typeof hasPermission>[0]) {
  return (
    hasPermission(session, "sig.evidencias", "view") ||
    hasPermission(session, "sig.auditorias", "view") ||
    hasPermission(session, "sig.requisitos", "view")
  );
}

function canEditEvidence(session: Parameters<typeof hasPermission>[0]) {
  return (
    hasPermission(session, "sig.evidencias", "edit") || hasPermission(session, "sig.auditorias", "edit")
  );
}

function parseJsonField<T>(value: FormDataEntryValue | null): T | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canViewEvidence(session)) return forbidden();

  try {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const processId = req.nextUrl.searchParams.get("processId") || undefined;
    const requirementId = req.nextUrl.searchParams.get("requirementId") || undefined;
    const status = (req.nextUrl.searchParams.get("status") as SigEvidenceStatus | null) || undefined;
    return ok(await listSigEvidences({ q, processId, requirementId, status }));
  } catch (e) {
    return serverError("Error listando evidencias SIG", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEditEvidence(session)) return forbidden();

  try {
    const contentType = req.headers.get("content-type") || "";
    let payload: Record<string, unknown>;
    let file: { buffer: Buffer; fileName: string; mimeType: string } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      payload = {
        type: form.get("type") || undefined,
        description: form.get("description"),
        evidenceDate: form.get("evidenceDate"),
        validUntil: form.get("validUntil") || null,
        status: form.get("status") || undefined,
        processId: form.get("processId") || null,
        requirementIds: parseJsonField<string[]>(form.get("requirementIds")) ?? [],
        auditId: form.get("auditId") || null,
        checklistItemId: form.get("checklistItemId") || null,
        findingId: form.get("findingId") || null,
        actionPlanId: form.get("actionPlanId") || null,
        actionPlanRole: form.get("actionPlanRole") || undefined,
      };
      const uploaded = form.get("file");
      if (uploaded instanceof File && uploaded.size > 0) {
        file = {
          buffer: Buffer.from(await uploaded.arrayBuffer()),
          fileName: uploaded.name,
          mimeType: uploaded.type || "application/octet-stream",
        };
      }
    } else {
      payload = await req.json();
    }

    const parsed = createEvidenceSchema.safeParse(payload);
    if (!parsed.success) return badRequest("Datos de evidencia inválidos", parsed.error.flatten());

    return created(
      await createSigEvidence({
        ...parsed.data,
        type: parsed.data.type as SigEvidenceType | undefined,
        createdById: sessionUserId(session),
        file,
      })
    );
  } catch (e) {
    if (e instanceof Error) return badRequest(e.message);
    return serverError("Error creando evidencia SIG", e);
  }
}
